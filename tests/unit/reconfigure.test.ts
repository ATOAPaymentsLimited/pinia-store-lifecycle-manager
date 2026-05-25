import { vi } from 'vitest'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { PiniaStoreLifecycleManager } from '../../src/plugin'
import { setupPinia, useUserStore, useReadonlyStore, useEmptyStore } from '../helpers/store-factory'

/**
 * Registers the plugin on the given pinia instance and captures the reconfigure() function
 * that is passed to the lifecycleEventHandler.
 */
function mountWithReconfigure(pinia: ReturnType<typeof createPinia>, opts?: { enableDebugLogs?: boolean }) {
  let capturedReconfigure: (() => void) | undefined
  pinia.use((ctx) =>
    PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => {
      capturedReconfigure = reconfigure
    }, opts)
  )
  return () => capturedReconfigure!()
}

describe('PiniaStoreLifecycleManager — reconfigure()', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = setupPinia()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when no reConfigure options are defined on the store', () => {
    it('skips the reconfigure operation without throwing', () => {
      const getReconfigure = mountWithReconfigure(pinia)
      useEmptyStore()
      expect(() => getReconfigure()).not.toThrow()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when reConfigure is a plain object', () => {
    it('updates specified state properties to their new values', () => {
      const getReconfigure = mountWithReconfigure(pinia)
      const store = useUserStore()
      store.name = 'Alice'
      store.role = 'admin'
      getReconfigure()
      expect(store.name).toBe('NewUser')
      expect(store.role).toBe('viewer')
    })

    it('does not modify properties absent from the reConfigure object', () => {
      const getReconfigure = mountWithReconfigure(pinia)
      const store = useUserStore()
      // reConfigure only sets name and role — token should be untouched
      store.token = 'my-token'
      getReconfigure()
      expect(store.token).toBe('my-token')
    })

    it('updates multiple properties in a single call', () => {
      const getReconfigure = mountWithReconfigure(pinia)
      const store = useUserStore()
      store.name = 'Bob'
      store.role = 'superadmin'
      getReconfigure()
      expect(store.name).toBe('NewUser')
      expect(store.role).toBe('viewer')
    })

    it('sets a property to null without throwing', () => {
      const useNullStore = defineStore('nullable-reconfigure', {
        state: () => ({ user: 'Alice' as string | null }),
        lifecycleOptions: {
          reConfigure: { user: null },
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useNullStore()
      expect(() => capturedReconfigure!()).not.toThrow()
      expect(store.user).toBeNull()
    })

    it('sets a property to undefined without throwing', () => {
      const useUndefinedStore = defineStore('undefined-reconfigure', {
        state: () => ({ label: 'hello' as string | undefined }),
        lifecycleOptions: {
          reConfigure: { label: undefined },
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useUndefinedStore()
      expect(() => capturedReconfigure!()).not.toThrow()
      expect(store.label).toBeUndefined()
    })

    it('applies falsy values (0, false, empty string) — they are not skipped', () => {
      const useFalsyStore = defineStore('falsy-reconfigure', {
        state: () => ({ count: 10, active: true, label: 'hello' }),
        lifecycleOptions: {
          reConfigure: { count: 0, active: false, label: '' },
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useFalsyStore()
      capturedReconfigure!()
      expect(store.count).toBe(0)
      expect(store.active).toBe(false)
      expect(store.label).toBe('')
    })

    it('replaces an array property with a new array value', () => {
      const useArrayStore = defineStore('array-reconfigure', {
        state: () => ({ items: ['a', 'b', 'c'] as string[] }),
        lifecycleOptions: {
          reConfigure: { items: ['x', 'y'] },
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useArrayStore()
      capturedReconfigure!()
      expect(store.items).toEqual(['x', 'y'])
    })

    it('replaces a nested object property entirely (shallow — does not deep merge)', () => {
      const useNestedReconfigureStore = defineStore('nested-reconfigure', {
        state: () => ({
          profile: { name: 'Alice', age: 30, extra: 'stillHere' } as Record<string, unknown>,
        }),
        lifecycleOptions: {
          reConfigure: { profile: { name: 'NewUser' } },
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useNestedReconfigureStore()
      capturedReconfigure!()
      // shallow replacement — only name is in the new object, age and extra should be gone
      expect(store.profile).toEqual({ name: 'NewUser' })
      expect((store.profile as any).age).toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when reConfigure is an empty object', () => {
    it('runs without error and modifies no state properties', () => {
      const useEmptyReconfigureStore = defineStore('empty-reconfigure', {
        state: () => ({ x: 'hello', y: 42 }),
        lifecycleOptions: {
          reConfigure: {},
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useEmptyReconfigureStore()
      store.x = 'changed'
      store.y = 100
      expect(() => capturedReconfigure!()).not.toThrow()
      expect(store.x).toBe('changed')
      expect(store.y).toBe(100)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when reConfigure is a function that takes the store as an argument', () => {
    it('calls the function with the current store instance', () => {
      const reconfigureFn = vi.fn((store: any) => ({ name: 'reconfigure-from-fn' }))
      const useFnArgStore = defineStore('fn-arg-reconfigure-store', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          reConfigure: reconfigureFn,
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useFnArgStore()
      capturedReconfigure!()
      expect(reconfigureFn).toHaveBeenCalledWith(store)
    })

    it('updates properties to the values returned by the function', () => {
      const useFnReturnStore = defineStore('fn-return-reconfigure-store', {
        state: () => ({ name: 'Alice', count: 5 }),
        lifecycleOptions: {
          reConfigure: (_store: any) => ({ name: 'fn-reconfigure', count: 99 }),
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useFnReturnStore()
      capturedReconfigure!()
      expect(store.name).toBe('fn-reconfigure')
      expect(store.count).toBe(99)
    })

    it('reads store state at the time reconfigure() is called — not at definition time', () => {
      const useDynamicStore = defineStore('fn-dynamic-reconfigure-store', {
        state: () => ({ role: 'admin', name: 'initial' }),
        lifecycleOptions: {
          reConfigure: (store: any) => ({
            name: 'late-' + store.role,
          }),
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useDynamicStore()
      // change role after store creation — reconfigure should pick up the updated value
      store.role = 'manager'
      capturedReconfigure!()
      expect(store.name).toBe('late-manager')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when reConfigure is a zero-argument function', () => {
    it('calls the function with no arguments', () => {
      const reconfigureFn = vi.fn(() => ({ name: 'zero-arg-reconfigure' }))
      const useZeroArgStore = defineStore('zero-arg-reconfigure-store', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          reConfigure: reconfigureFn,
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      useZeroArgStore()
      capturedReconfigure!()
      // zero-arg function: Function.length === 0, so called with no args
      expect(reconfigureFn).toHaveBeenCalledWith()
    })

    it('updates properties to the values returned by the function', () => {
      const useZeroReturnStore = defineStore('zero-return-reconfigure-store', {
        state: () => ({ value: 'original' }),
        lifecycleOptions: {
          reConfigure: () => ({ value: 'from-zero-arg-reconfigure' }),
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useZeroReturnStore()
      store.value = 'changed'
      capturedReconfigure!()
      expect(store.value).toBe('from-zero-arg-reconfigure')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when reConfigure is a function with a default parameter value', () => {
    it('is treated as a zero-argument function — store arg is not passed (Function.length = 0)', () => {
      const reconfigureFn = vi.fn((store = {} as any) => ({ name: 'default-param-reconfigure' }))
      expect(reconfigureFn.length).toBe(0) // confirm Function.length is 0 for default params
      const useDefaultParamStore = defineStore('default-param-reconfigure-store', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          reConfigure: reconfigureFn,
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const storeInstance = useDefaultParamStore()
      capturedReconfigure!()
      // Because length === 0, the plugin calls it with no arguments
      const callArg = reconfigureFn.mock.calls[0][0]
      expect(callArg).toBeUndefined()
      expect(storeInstance.name).toBe('default-param-reconfigure')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when reConfigure is a function that returns void', () => {
    it('skips the reconfigure loop without throwing', () => {
      const useVoidFnStore = defineStore('void-fn-reconfigure-store', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          reConfigure: (): void => { /* returns nothing */ },
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useVoidFnStore()
      store.name = 'Changed'
      expect(() => capturedReconfigure!()).not.toThrow()
      // name should remain unchanged since reconfigureOptions is undefined/void
      expect(store.name).toBe('Changed')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when reConfigure function itself throws during invocation', () => {
    it('propagates the error — does not swallow it', () => {
      const useThrowingFnStore = defineStore('throwing-fn-reconfigure-store', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          reConfigure: (): any => { throw new Error('reconfigure function exploded') },
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      useThrowingFnStore()
      expect(() => capturedReconfigure!()).toThrow('reconfigure function exploded')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when a property in reConfigure options is readonly', () => {
    describe('when enableDebugLogs is true', () => {
      it('skips the readonly property and emits a non-writable warning', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const useReadonlyReconfigureStore = defineStore('readonly-reconfigure-store', {
          state: () => ({ name: 'Base' }),
          getters: {
            computedLabel: (state) => `Label: ${state.name}`,
          },
          lifecycleOptions: {
            reConfigure: {
              name: 'NewName',
              computedLabel: 'Label: NewName' as any,
            },
          },
        })
        let capturedReconfigure: (() => void) | undefined
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure }, { enableDebugLogs: true })
        )
        const store = useReadonlyReconfigureStore()
        capturedReconfigure!()
        expect(warnSpy).toHaveBeenCalled()
        const allWarnArgs = warnSpy.mock.calls.flat().join(' ')
        expect(allWarnArgs).toContain('computedLabel')
        // The writable property should still be updated
        expect(store.name).toBe('NewName')
      })
    })

    describe('when enableDebugLogs is false', () => {
      it('silently skips the readonly property without logging', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const useReadonlySilentStore = defineStore('readonly-reconfigure-silent-store', {
          state: () => ({ name: 'Base' }),
          getters: {
            computedLabel: (state) => `Label: ${state.name}`,
          },
          lifecycleOptions: {
            reConfigure: {
              name: 'NewName',
              computedLabel: 'Label: NewName' as any,
            },
          },
        })
        let capturedReconfigure: (() => void) | undefined
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure }, { enableDebugLogs: false })
        )
        const store = useReadonlySilentStore()
        expect(() => capturedReconfigure!()).not.toThrow()
        // devWarnNonWritable should NOT be called when enableDebugLogs is false
        const customWarnCalls = warnSpy.mock.calls.filter(
          (args) => typeof args[0] === 'string' && args[0].includes('non-writable')
        )
        expect(customWarnCalls).toHaveLength(0)
        // The writable property should still be updated
        expect(store.name).toBe('NewName')
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when property assignment throws an error', () => {
    it('catches the error and calls devError', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const useBadPropStore = defineStore('bad-prop-reconfigure-store', {
        state: () => ({ goodProp: 'ok', badProp: 'bad' }),
        lifecycleOptions: {
          reConfigure: { goodProp: 'reconfigured', badProp: 'shouldThrow' },
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useBadPropStore()
      Object.defineProperty(store, 'badProp', {
        set() { throw new Error('cannot set badProp') },
        get() { return 'bad' },
        configurable: true,
      })
      capturedReconfigure!()
      expect(errorSpy).toHaveBeenCalled()
    })

    it('devError fires regardless of the enableDebugLogs setting', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const useBadPropStore2 = defineStore('bad-prop-reconfigure-store-2', {
        state: () => ({ goodProp: 'ok', badProp: 'bad' }),
        lifecycleOptions: {
          reConfigure: { goodProp: 'reconfigured', badProp: 'shouldThrow' },
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure }, { enableDebugLogs: false })
      )
      const store = useBadPropStore2()
      Object.defineProperty(store, 'badProp', {
        set() { throw new Error('cannot set badProp') },
        get() { return 'bad' },
        configurable: true,
      })
      capturedReconfigure!()
      expect(errorSpy).toHaveBeenCalled()
    })

    it('continues reconfiguring remaining properties after the error', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const useContinueStore = defineStore('continue-after-reconfigure-error', {
        state: () => ({ a: 'original-a', b: 'original-b', c: 'original-c' }),
        lifecycleOptions: {
          reConfigure: { a: 'reconfigure-a', b: 'shouldThrow', c: 'reconfigure-c' },
        },
      })
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure })
      )
      const store = useContinueStore()
      Object.defineProperty(store, 'b', {
        set() { throw new Error('cannot set b') },
        get() { return 'still-original-b' },
        configurable: true,
      })
      store.a = 'changed-a'
      store.c = 'changed-c'
      capturedReconfigure!()
      expect(store.a).toBe('reconfigure-a')
      expect(store.c).toBe('reconfigure-c')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when reconfigure() is called multiple times', () => {
    it('produces the same final state on every call — idempotent', () => {
      const getReconfigure = mountWithReconfigure(pinia)
      const store = useUserStore()
      store.name = 'Bob'
      store.role = 'superadmin'
      getReconfigure()
      const stateAfterFirst = { name: store.name, role: store.role }
      store.name = 'Charlie'
      store.role = 'editor'
      getReconfigure()
      expect(store.name).toBe(stateAfterFirst.name)
      expect(store.role).toBe(stateAfterFirst.role)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when enableDebugLogs is true', () => {
    it('logs the start of the reconfigure operation with reConfigure options', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure }, { enableDebugLogs: true })
      )
      useUserStore()
      logSpy.mockClear()
      capturedReconfigure!()
      const allArgs = logSpy.mock.calls.flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('reconfigure state operation')
    })

    it('logs each property update showing old and new values', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure }, { enableDebugLogs: true })
      )
      const store = useUserStore()
      store.name = 'ChangedName'
      logSpy.mockClear()
      capturedReconfigure!()
      const allArgs = logSpy.mock.calls.flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      // Should log oldValue and newValue for 'name'
      expect(allArgs).toContain('name')
      expect(allArgs).toContain('oldValue')
      expect(allArgs).toContain('newValue')
    })

    it('logs completion of the reconfigure operation', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure }, { enableDebugLogs: true })
      )
      useUserStore()
      logSpy.mockClear()
      capturedReconfigure!()
      const allArgs = logSpy.mock.calls.flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('completed')
    })

    it('logs skip message when no reConfigure options are defined', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      let capturedReconfigure: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reconfigure }) => { capturedReconfigure = reconfigure }, { enableDebugLogs: true })
      )
      useEmptyStore()
      logSpy.mockClear()
      capturedReconfigure!()
      const allArgs = logSpy.mock.calls.flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('skipped')
    })
  })
})
