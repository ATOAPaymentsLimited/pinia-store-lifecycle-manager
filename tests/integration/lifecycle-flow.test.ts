import { createPinia, defineStore, setActivePinia } from 'pinia'
import { createApp } from 'vue'
import { vi } from 'vitest'
import { PiniaStoreLifecycleManager } from '../../src/plugin'
import { setupPinia, useUserStore, useDisabledStore, useEmptyStore } from '../helpers/store-factory'

type LifecycleEvents = {
  reset: () => void
  reconfigure: () => void
  refresh: (o: { mode: 'full' | 'partial'; includeResetOnlyActions?: boolean }) => void
}

function mountLifecycle(pinia: ReturnType<typeof createPinia>) {
  const events: Record<string, LifecycleEvents> = {}
  pinia.use((ctx) =>
    PiniaStoreLifecycleManager(ctx, (e) => {
      events[ctx.store.$id] = e
    })
  )
  return events
}

describe('Full lifecycle flow — end-to-end scenarios', () => {
  let pinia: ReturnType<typeof createPinia>
  let events: Record<string, LifecycleEvents>

  beforeEach(() => {
    pinia = setupPinia()
    events = mountLifecycle(pinia)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ───────────────────────────────────────────────────────────────────────────
  describe('behavioral boundary: plugin is per-store, not global', () => {
    it('reset() only affects the specific store bound to that plugin call', () => {
      const store = useUserStore()
      const empty = useEmptyStore()
      store.name = 'Modified'
      empty.value = 'also-modified'

      events['user'].reset()

      // user store should be reset
      expect(store.name).toBe('')
      // empty store has no clean options, so its state is unaffected
      expect(empty.value).toBe('also-modified')
    })

    it('a store not yet accessed when the event fires is not reset', () => {
      // Only register the empty store, NOT the user store
      useEmptyStore()
      // Fire reset on empty store's event — user store was never accessed
      events['empty'].reset()

      // Now access user store for the first time — should have initial values
      const store = useUserStore()
      expect(store.name).toBe('Alice')
    })

    it('accessing the store after the event fires registers it for future events', () => {
      // Access user store, verify initial reset works
      const store = useUserStore()
      store.name = 'Modified'
      events['user'].reset()
      expect(store.name).toBe('')

      // Modify again, fire reset again — should still work
      store.name = 'ModifiedAgain'
      events['user'].reset()
      expect(store.name).toBe('')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  describe('logout scenario: reset only', () => {
    it('clears all state properties defined in clean options', () => {
      const store = useUserStore()
      store.name = 'Bob'
      store.token = 'tok999'
      store.role = 'superadmin'
      store.count = 42
      store.items = ['x', 'y']
      store.preferences = { theme: 'dark', lang: 'fr' }

      events['user'].reset()

      expect(store.name).toBe('')
      expect(store.token).toBe('')
      expect(store.role).toBe('guest')
      expect(store.count).toBe(0)
      expect(store.items).toEqual([])
      expect(store.preferences).toEqual({})
    })

    it('leaves stores with disableListener: true completely unaffected', () => {
      // Access disabled store — no lifecycle events should be registered for it
      const disabled = useDisabledStore()
      disabled.value = 'modified'

      // events['disabled'] should be undefined because the handler was never called
      expect(events['disabled']).toBeUndefined()
      // The store value remains unaffected
      expect(disabled.value).toBe('modified')
    })

    it('preserves state properties not listed in clean options', () => {
      // Define a store that only partially lists clean options
      const usePartialCleanStore = defineStore('partial-clean-integration', {
        state: () => ({ a: 'original-a', b: 'original-b', c: 'original-c' }),
        lifecycleOptions: {
          clean: { a: 'reset-a' }, // only 'a' is in clean, 'b' and 'c' are absent
        },
      })
      const partialEvents: Record<string, LifecycleEvents> = {}
      const pinia2 = setupPinia()
      pinia2.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, (e) => {
          partialEvents[ctx.store.$id] = e
        })
      )
      const store = usePartialCleanStore()
      store.a = 'changed-a'
      store.b = 'changed-b'

      partialEvents['partial-clean-integration'].reset()

      expect(store.a).toBe('reset-a')
      expect(store.b).toBe('changed-b')
      expect(store.c).toBe('original-c')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  describe('profile switch scenario: reset then full refresh', () => {
    it('clears state then calls all refresh actions including resetOnly ones', () => {
      const store = useUserStore()
      store.name = 'OldUser'
      store.role = 'oldRole'

      events['user'].reset()
      expect(store.name).toBe('')
      expect(store.role).toBe('guest')

      // Full refresh calls ALL actions including resetOnly ones (fetchPermissions)
      events['user'].refresh({ mode: 'full' })

      // fetchProfile sets name to 'default-id'
      expect(store.name).toBe('default-id')
      // fetchPermissions (resetOnly) sets role to 'viewer'
      expect(store.role).toBe('viewer')
      // fetchSettings sets token to 'refreshed'
      expect(store.token).toBe('refreshed')
    })

    it('refresh actions receive the correct params after state is cleared', () => {
      const store = useUserStore()
      const fetchProfileSpy = vi.spyOn(store, 'fetchProfile')
      const fetchSettingsSpy = vi.spyOn(store, 'fetchSettings')
      const fetchPermissionsSpy = vi.spyOn(store, 'fetchPermissions')

      events['user'].reset()
      events['user'].refresh({ mode: 'full' })

      expect(fetchProfileSpy).toHaveBeenCalledWith('default-id')
      expect(fetchSettingsSpy).toHaveBeenCalledWith()
      expect(fetchPermissionsSpy).toHaveBeenCalledWith('viewer')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  describe('soft update scenario: reconfigure then partial refresh', () => {
    it('updates config properties then calls only non-resetOnly actions', () => {
      const store = useUserStore()
      const fetchProfileSpy = vi.spyOn(store, 'fetchProfile')
      const fetchSettingsSpy = vi.spyOn(store, 'fetchSettings')
      const fetchPermissionsSpy = vi.spyOn(store, 'fetchPermissions')

      events['user'].reconfigure()
      // reConfigure sets name='NewUser', role='viewer'
      expect(store.name).toBe('NewUser')
      expect(store.role).toBe('viewer')

      events['user'].refresh({ mode: 'partial' })

      // Partial refresh skips resetOnly actions (fetchPermissions has resetOnly: true)
      expect(fetchProfileSpy).toHaveBeenCalled()
      expect(fetchSettingsSpy).toHaveBeenCalled()
      expect(fetchPermissionsSpy).not.toHaveBeenCalled()
    })

    it('preserves state properties not listed in reConfigure options', () => {
      const store = useUserStore()
      store.token = 'my-token'
      store.count = 5
      store.items = ['item1', 'item2']

      events['user'].reconfigure()

      // Only name and role are in reConfigure — other properties should be unchanged
      expect(store.name).toBe('NewUser')
      expect(store.role).toBe('viewer')
      expect(store.token).toBe('my-token')
      expect(store.count).toBe(5)
      expect(store.items).toEqual(['item1', 'item2'])
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  describe('operation chaining', () => {
    it('reset() then reconfigure() — final state is clean values overwritten by reconfigure values', () => {
      const store = useUserStore()
      store.name = 'OldName'
      store.role = 'oldRole'
      store.token = 'old-token'

      events['user'].reset()
      // After reset: name='', role='guest', token=''
      expect(store.name).toBe('')
      expect(store.role).toBe('guest')
      expect(store.token).toBe('')

      events['user'].reconfigure()
      // reConfigure applies name='NewUser', role='viewer' on top of reset values
      expect(store.name).toBe('NewUser')
      expect(store.role).toBe('viewer')
      // token was reset but not reconfigured — stays ''
      expect(store.token).toBe('')
    })

    it('reconfigure() then reset() — final state reflects only the clean values', () => {
      const store = useUserStore()

      events['user'].reconfigure()
      // After reconfigure: name='NewUser', role='viewer'
      expect(store.name).toBe('NewUser')
      expect(store.role).toBe('viewer')

      events['user'].reset()
      // Reset overwrites everything with clean values
      expect(store.name).toBe('')
      expect(store.role).toBe('guest')
    })

    it('reset() then refresh() — actions are called with post-reset store state', () => {
      const store = useUserStore()
      store.name = 'OldName'

      events['user'].reset()
      // After reset name is '', token is ''
      expect(store.name).toBe('')

      // Refresh in full mode — fetchProfile will set name to 'default-id'
      const fetchProfileSpy = vi.spyOn(store, 'fetchProfile')
      events['user'].refresh({ mode: 'full' })

      // fetchProfile is called with its configured params, not with current store state
      expect(fetchProfileSpy).toHaveBeenCalledWith('default-id')
      expect(store.name).toBe('default-id')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  describe('idempotency', () => {
    it('calling reset() twice produces identical final state both times', () => {
      const store = useUserStore()

      store.name = 'First'
      store.token = 'tok1'
      events['user'].reset()
      const stateAfterFirst = {
        name: store.name,
        token: store.token,
        role: store.role,
        count: store.count,
      }

      // Modify state again then reset a second time
      store.name = 'Second'
      store.token = 'tok2'
      events['user'].reset()

      expect(store.name).toBe(stateAfterFirst.name)
      expect(store.token).toBe(stateAfterFirst.token)
      expect(store.role).toBe(stateAfterFirst.role)
      expect(store.count).toBe(stateAfterFirst.count)
    })

    it('calling reconfigure() twice produces identical final state both times', () => {
      const store = useUserStore()

      events['user'].reconfigure()
      const stateAfterFirst = { name: store.name, role: store.role }

      // Mutate state then reconfigure again
      store.name = 'TemporaryName'
      store.role = 'temporaryRole'
      events['user'].reconfigure()

      expect(store.name).toBe(stateAfterFirst.name)
      expect(store.role).toBe(stateAfterFirst.role)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  describe('SSR hydration scenario', () => {
    describe('when _hasStoreLifecycleManagerListener exists in hydrated server state', () => {
      it('skips listener registration on the client — guard detects the flag', () => {
        const p2 = createPinia()
        const app2 = createApp({})
        app2.use(p2)
        setActivePinia(p2)

        // Pre-seed hydrated server state with the guard flag set
        p2.state.value['user'] = {
          name: 'Alice',
          token: 'abc123',
          role: 'admin',
          count: 0,
          items: ['a', 'b'],
          preferences: { theme: 'light', lang: 'en' },
          _hasStoreLifecycleManagerListener: true,
        }

        const handler = vi.fn()
        p2.use((ctx) => PiniaStoreLifecycleManager(ctx, handler))
        useUserStore()

        expect(handler).not.toHaveBeenCalled()
      })

      it('does not attach lifecycle event bindings on the client', () => {
        const p2 = createPinia()
        const app2 = createApp({})
        app2.use(p2)
        setActivePinia(p2)

        p2.state.value['user'] = {
          name: 'Alice',
          token: 'abc123',
          role: 'admin',
          count: 0,
          items: ['a', 'b'],
          preferences: { theme: 'light', lang: 'en' },
          _hasStoreLifecycleManagerListener: true,
        }

        const capturedEvents: Record<string, LifecycleEvents> = {}
        p2.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, (e) => {
            capturedEvents[ctx.store.$id] = e
          })
        )
        useUserStore()

        // Handler never called, so no events were captured for 'user'
        expect(capturedEvents['user']).toBeUndefined()
      })
    })

    describe('when _hasStoreLifecycleManagerListener is absent from hydrated state', () => {
      it('registers the listener normally on the client', () => {
        const p2 = createPinia()
        const app2 = createApp({})
        app2.use(p2)
        setActivePinia(p2)

        // Pre-seed WITHOUT the guard flag
        p2.state.value['user'] = {
          name: 'HydratedAlice',
          token: 'hydrated-token',
          role: 'admin',
          count: 0,
          items: ['a', 'b'],
          preferences: { theme: 'light', lang: 'en' },
          // _hasStoreLifecycleManagerListener is absent
        }

        const handler = vi.fn()
        p2.use((ctx) => PiniaStoreLifecycleManager(ctx, handler))
        useUserStore()

        expect(handler).toHaveBeenCalledOnce()
      })
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  describe('multiple stores registered to the same plugin instance', () => {
    it('each store uses its own lifecycleOptions independently', () => {
      const useStoreA = defineStore('store-a-multi', {
        state: () => ({ x: 'original-a' }),
        lifecycleOptions: {
          clean: { x: 'reset-a' },
          reConfigure: { x: 'reconfig-a' },
        },
      })
      const useStoreB = defineStore('store-b-multi', {
        state: () => ({ y: 'original-b' }),
        lifecycleOptions: {
          clean: { y: 'reset-b' },
          reConfigure: { y: 'reconfig-b' },
        },
      })

      const multiEvents: Record<string, LifecycleEvents> = {}
      const pinia3 = setupPinia()
      pinia3.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, (e) => {
          multiEvents[ctx.store.$id] = e
        })
      )

      const storeA = useStoreA()
      const storeB = useStoreB()

      storeA.x = 'changed-a'
      storeB.y = 'changed-b'

      // Reset only store A
      multiEvents['store-a-multi'].reset()
      expect(storeA.x).toBe('reset-a')
      expect(storeB.y).toBe('changed-b') // B unaffected

      // Reconfigure only store B
      multiEvents['store-b-multi'].reconfigure()
      expect(storeB.y).toBe('reconfig-b')
      expect(storeA.x).toBe('reset-a') // A unaffected
    })

    it('stores with disableListener: true are skipped while others are updated', () => {
      const useEnabledStore = defineStore('enabled-multi', {
        state: () => ({ value: 'original' }),
        lifecycleOptions: {
          clean: { value: 'reset-value' },
        },
      })
      const useSkippedStore = defineStore('skipped-multi', {
        state: () => ({ value: 'skip-original' }),
        lifecycleOptions: {
          disableListener: true,
          clean: { value: 'would-be-reset' },
        },
      })

      const multiEvents2: Record<string, LifecycleEvents> = {}
      const pinia4 = setupPinia()
      pinia4.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, (e) => {
          multiEvents2[ctx.store.$id] = e
        })
      )

      const enabled = useEnabledStore()
      const skipped = useSkippedStore()

      enabled.value = 'changed'
      skipped.value = 'changed-skip'

      // Only 'enabled-multi' should have events registered
      expect(multiEvents2['enabled-multi']).toBeDefined()
      expect(multiEvents2['skipped-multi']).toBeUndefined()

      // Reset the enabled store
      multiEvents2['enabled-multi'].reset()
      expect(enabled.value).toBe('reset-value')
      // Skipped store is completely unaffected
      expect(skipped.value).toBe('changed-skip')
    })
  })
})
