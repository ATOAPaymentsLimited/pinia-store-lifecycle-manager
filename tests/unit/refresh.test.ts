import { vi } from 'vitest'
import { createPinia, defineStore } from 'pinia'
import { PiniaStoreLifecycleManager } from '../../src/plugin'
import { setupPinia, useUserStore, useEmptyStore } from '../helpers/store-factory'

type RefreshFn = (o: { mode: 'full' | 'partial'; includeResetOnlyActions?: boolean }) => void

function mountWithRefresh(
  pinia: ReturnType<typeof createPinia>,
  opts?: { enableDebugLogs?: boolean }
) {
  let capturedRefresh: RefreshFn | undefined
  pinia.use((ctx) =>
    PiniaStoreLifecycleManager(
      ctx,
      ({ refresh }) => {
        capturedRefresh = refresh
      },
      opts
    )
  )
  return (o: { mode: 'full' | 'partial'; includeResetOnlyActions?: boolean }) =>
    capturedRefresh!(o)
}

describe("PiniaStoreLifecycleManager — refresh()", () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = setupPinia()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when no refresh options are defined on the store", () => {
    it("skips the refresh operation without throwing", () => {
      const refresh = mountWithRefresh(pinia)
      useEmptyStore()
      expect(() => refresh({ mode: 'partial' })).not.toThrow()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("mode: 'partial'", () => {
    it("calls actions where resetOnly is false", () => {
      const refresh = mountWithRefresh(pinia)
      const store = useUserStore()
      const fetchProfileSpy = vi.spyOn(store, 'fetchProfile')
      const fetchSettingsSpy = vi.spyOn(store, 'fetchSettings')

      refresh({ mode: 'partial' })

      expect(fetchProfileSpy).toHaveBeenCalled()
      expect(fetchSettingsSpy).toHaveBeenCalled()
    })

    it("calls actions where resetOnly is not set (defaults to non-reset-only)", () => {
      const refresh = mountWithRefresh(pinia)
      const store = useUserStore()
      // fetchSettings has no resetOnly — defaults to false, so included in partial
      const fetchSettingsSpy = vi.spyOn(store, 'fetchSettings')

      refresh({ mode: 'partial' })

      expect(fetchSettingsSpy).toHaveBeenCalled()
    })

    it("skips actions where resetOnly is true", () => {
      const refresh = mountWithRefresh(pinia)
      const store = useUserStore()
      const fetchPermissionsSpy = vi.spyOn(store, 'fetchPermissions')

      refresh({ mode: 'partial' })

      expect(fetchPermissionsSpy).not.toHaveBeenCalled()
    })

    it("calls no actions when all defined actions have resetOnly: true", () => {
      const useAllResetStore = defineStore('all-reset-only', {
        state: () => ({ value: 'original' }),
        actions: {
          fetchA() { this.value = 'a' },
          fetchB() { this.value = 'b' },
        },
        lifecycleOptions: {
          refresh: {
            fetchA: { params: [], resetOnly: true },
            fetchB: { params: [], resetOnly: true },
          },
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useAllResetStore()
      const fetchASpy = vi.spyOn(store, 'fetchA')
      const fetchBSpy = vi.spyOn(store, 'fetchB')

      expect(() => refresh({ mode: 'partial' })).not.toThrow()
      expect(fetchASpy).not.toHaveBeenCalled()
      expect(fetchBSpy).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("mode: 'full'", () => {
    describe("when includeResetOnlyActions is false (default)", () => {
      it("calls both normal actions and resetOnly actions", () => {
        const refresh = mountWithRefresh(pinia)
        const store = useUserStore()
        const fetchProfileSpy = vi.spyOn(store, 'fetchProfile')
        const fetchSettingsSpy = vi.spyOn(store, 'fetchSettings')
        const fetchPermissionsSpy = vi.spyOn(store, 'fetchPermissions')

        refresh({ mode: 'full' })

        expect(fetchProfileSpy).toHaveBeenCalled()
        expect(fetchSettingsSpy).toHaveBeenCalled()
        expect(fetchPermissionsSpy).toHaveBeenCalled()
      })
    })

    describe("when includeResetOnlyActions is true", () => {
      it("calls only actions where resetOnly is true", () => {
        const refresh = mountWithRefresh(pinia)
        const store = useUserStore()
        const fetchPermissionsSpy = vi.spyOn(store, 'fetchPermissions')

        refresh({ mode: 'full', includeResetOnlyActions: true })

        expect(fetchPermissionsSpy).toHaveBeenCalled()
      })

      it("skips actions where resetOnly is false or unset", () => {
        const refresh = mountWithRefresh(pinia)
        const store = useUserStore()
        const fetchProfileSpy = vi.spyOn(store, 'fetchProfile')
        const fetchSettingsSpy = vi.spyOn(store, 'fetchSettings')

        refresh({ mode: 'full', includeResetOnlyActions: true })

        expect(fetchProfileSpy).not.toHaveBeenCalled()
        expect(fetchSettingsSpy).not.toHaveBeenCalled()
      })

      describe("when no actions in the store have resetOnly: true", () => {
        it("filters out all actions — calls none and does not throw", () => {
          const useNoResetOnlyStore = defineStore('no-reset-only', {
            state: () => ({ value: 'original' }),
            actions: {
              fetchX() { this.value = 'x' },
              fetchY() { this.value = 'y' },
            },
            lifecycleOptions: {
              refresh: {
                fetchX: { params: [] },
                fetchY: { params: [] },
              },
            },
          })

          const refresh = mountWithRefresh(pinia)
          const store = useNoResetOnlyStore()
          const fetchXSpy = vi.spyOn(store, 'fetchX')
          const fetchYSpy = vi.spyOn(store, 'fetchY')

          expect(() => refresh({ mode: 'full', includeResetOnlyActions: true })).not.toThrow()
          expect(fetchXSpy).not.toHaveBeenCalled()
          expect(fetchYSpy).not.toHaveBeenCalled()
        })
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when an action has params defined", () => {
    it("calls the action with the specified params array", () => {
      const refresh = mountWithRefresh(pinia)
      const store = useUserStore()
      const fetchProfileSpy = vi.spyOn(store, 'fetchProfile')

      refresh({ mode: 'partial' })

      expect(fetchProfileSpy).toHaveBeenCalledWith('default-id')
    })

    it("calls the action with correct argument types matching the action signature", () => {
      const refresh = mountWithRefresh(pinia)
      const store = useUserStore()
      const fetchPermissionsSpy = vi.spyOn(store, 'fetchPermissions')

      refresh({ mode: 'full' })

      // fetchPermissions expects a string role, params are ['viewer']
      expect(fetchPermissionsSpy).toHaveBeenCalledWith('viewer')
      expect(typeof fetchPermissionsSpy.mock.calls[0][0]).toBe('string')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when an action entry has no params key", () => {
    it("calls the action with no arguments using the empty array fallback", () => {
      const useNoParamsStore = defineStore('no-params', {
        state: () => ({ value: 'original' }),
        actions: {
          fetch() { this.value = 'fetched' },
        },
        lifecycleOptions: {
          refresh: {
            fetch: {} as any,
          },
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useNoParamsStore()
      const fetchSpy = vi.spyOn(store, 'fetch')

      refresh({ mode: 'partial' })

      expect(fetchSpy).toHaveBeenCalledWith()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when an action entry has params set to null", () => {
    it("calls the action with no arguments — null coalesces to empty array", () => {
      const useNullParamsStore = defineStore('null-params', {
        state: () => ({ value: 'original' }),
        actions: {
          fetch() { this.value = 'fetched' },
        },
        lifecycleOptions: {
          refresh: {
            fetch: { params: null as any },
          },
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useNullParamsStore()
      const fetchSpy = vi.spyOn(store, 'fetch')

      refresh({ mode: 'partial' })

      expect(fetchSpy).toHaveBeenCalledWith()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when refresh is a function that takes the store as an argument", () => {
    it("calls the function with the current store instance", () => {
      const refreshFn = vi.fn((_store: any) => ({
        fetchProfile: { params: ['fn-id'] },
      }))

      const useFnArgRefreshStore = defineStore('fn-arg-refresh', {
        state: () => ({ name: 'initial' }),
        actions: {
          fetchProfile(id: string) { this.name = id },
        },
        lifecycleOptions: {
          refresh: refreshFn,
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useFnArgRefreshStore()

      refresh({ mode: 'partial' })

      expect(refreshFn).toHaveBeenCalledWith(store)
    })

    it("executes the actions returned by the function", () => {
      const useFnReturnRefreshStore = defineStore('fn-return-refresh', {
        state: () => ({ name: 'initial' }),
        actions: {
          fetchProfile(id: string) { this.name = id },
        },
        lifecycleOptions: {
          refresh: (_store: any) => ({
            fetchProfile: { params: ['from-fn'] },
          }),
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useFnReturnRefreshStore()

      refresh({ mode: 'partial' })

      expect(store.name).toBe('from-fn')
    })

    it("reads store state at the time refresh() is called for dynamic params", () => {
      const useDynamicParamsStore = defineStore('dynamic-params-refresh', {
        state: () => ({ userId: 'default', name: 'initial' }),
        actions: {
          fetchProfile(id: string) { this.name = id },
        },
        lifecycleOptions: {
          refresh: (store: any) => ({
            fetchProfile: { params: [store.userId] },
          }),
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useDynamicParamsStore()
      store.userId = 'dynamic-user'

      refresh({ mode: 'partial' })

      expect(store.name).toBe('dynamic-user')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when refresh is a zero-argument function", () => {
    it("calls the function with no arguments", () => {
      const refreshFn = vi.fn(() => ({
        fetchProfile: { params: ['zero-arg-id'] },
      }))

      const useZeroArgRefreshStore = defineStore('zero-arg-refresh', {
        state: () => ({ name: 'initial' }),
        actions: {
          fetchProfile(id: string) { this.name = id },
        },
        lifecycleOptions: {
          refresh: refreshFn,
        },
      })

      const refresh = mountWithRefresh(pinia)
      useZeroArgRefreshStore()

      refresh({ mode: 'partial' })

      // zero-arg function — called with no args
      expect(refreshFn).toHaveBeenCalledWith()
    })

    it("executes the actions returned by the function", () => {
      const useZeroArgActionsStore = defineStore('zero-arg-actions', {
        state: () => ({ name: 'initial' }),
        actions: {
          fetchProfile(id: string) { this.name = id },
        },
        lifecycleOptions: {
          refresh: () => ({
            fetchProfile: { params: ['from-zero-arg'] },
          }),
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useZeroArgActionsStore()

      refresh({ mode: 'partial' })

      expect(store.name).toBe('from-zero-arg')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when refresh is a function that returns void", () => {
    it("skips the refresh loop without throwing", () => {
      const useVoidRefreshStore = defineStore('void-refresh', {
        state: () => ({ name: 'initial' }),
        actions: {
          fetchProfile(id: string) { this.name = id },
        },
        lifecycleOptions: {
          refresh: (): void => { /* returns nothing */ },
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useVoidRefreshStore()

      expect(() => refresh({ mode: 'partial' })).not.toThrow()
      expect(store.name).toBe('initial')
    })

    describe("when enableDebugLogs is true", () => {
      it("logs 'Invalid refresh result' skip message", () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const useVoidRefreshLogStore = defineStore('void-refresh-log', {
          state: () => ({ name: 'initial' }),
          actions: {
            fetchProfile(id: string) { this.name = id },
          },
          lifecycleOptions: {
            refresh: (): void => { /* returns nothing */ },
          },
        })

        const refresh = mountWithRefresh(pinia, { enableDebugLogs: true })
        useVoidRefreshLogStore()
        logSpy.mockClear()

        refresh({ mode: 'partial' })

        const allArgs = logSpy.mock.calls
          .flat()
          .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
          .join(' ')
        expect(allArgs).toContain('Invalid refresh result')
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when refresh options resolve to an empty object", () => {
    it("calls no actions and does not throw", () => {
      const useEmptyRefreshStore = defineStore('empty-refresh', {
        state: () => ({ value: 'original' }),
        actions: {
          fetch() { this.value = 'fetched' },
        },
        lifecycleOptions: {
          refresh: {},
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useEmptyRefreshStore()
      const fetchSpy = vi.spyOn(store, 'fetch')

      expect(() => refresh({ mode: 'partial' })).not.toThrow()
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when a specified action does not exist on the store", () => {
    it("skips the non-existent action without throwing", () => {
      const useGhostActionStore = defineStore('ghost-action', {
        state: () => ({ value: 'original' }),
        actions: {
          realAction() { this.value = 'real' },
        },
        lifecycleOptions: {
          refresh: {
            ghostAction: { params: [] } as any,
          },
        },
      })

      const refresh = mountWithRefresh(pinia)
      useGhostActionStore()

      expect(() => refresh({ mode: 'partial' })).not.toThrow()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when refresh options contain a mix of existing and non-existing actions", () => {
    it("calls the existing actions and skips the non-existing ones in the same pass", () => {
      const useMixedStore = defineStore('mixed-actions', {
        state: () => ({ value: 'original' }),
        actions: {
          realAction() { this.value = 'real' },
        },
        lifecycleOptions: {
          refresh: {
            realAction: { params: [] },
            ghostAction: { params: [] } as any,
          },
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useMixedStore()
      const realActionSpy = vi.spyOn(store, 'realAction')

      expect(() => refresh({ mode: 'partial' })).not.toThrow()
      expect(realActionSpy).toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when a refresh action is async (returns a Promise)", () => {
    it("calls the action without awaiting the result — fire and forget", async () => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
      let resolved = false

      const useAsyncStore = defineStore('async-refresh', {
        state: () => ({ value: 'original' }),
        actions: {
          async fetchAsync() {
            await delay(50)
            resolved = true
            this.value = 'fetched'
          },
        },
        lifecycleOptions: {
          refresh: {
            fetchAsync: { params: [] },
          },
        },
      })

      const refresh = mountWithRefresh(pinia)
      useAsyncStore()

      // synchronous call — should NOT have awaited the promise
      refresh({ mode: 'partial' })

      // resolved should still be false immediately after (not awaited)
      expect(resolved).toBe(false)
    })

    it("a rejected async action does not throw synchronously in the plugin", () => {
      const useRejectStore = defineStore('reject-refresh', {
        state: () => ({ value: 'original' }),
        actions: {
          async fetchAsync(): Promise<void> {
            // rejection is swallowed internally to avoid unhandled rejection
          },
        },
        lifecycleOptions: {
          refresh: {
            fetchAsync: { params: [] },
          },
        },
      })

      const refresh = mountWithRefresh(pinia)
      const store = useRejectStore()

      // Replace the action with one that returns a rejected promise but has a noop .catch attached
      // to prevent global unhandled rejection, while still verifying the plugin doesn't throw sync
      vi.spyOn(store, 'fetchAsync').mockImplementation(async () => {
        const p = Promise.reject(new Error('async rejection'))
        p.catch(() => { /* suppress unhandled rejection */ })
        return p
      })

      expect(() => refresh({ mode: 'partial' })).not.toThrow()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when a refresh action throws synchronously", () => {
    it("propagates the error — subsequent actions in the loop are not called", () => {
      const secondActionSpy = vi.fn()

      const useThrowStore = defineStore('throw-refresh', {
        state: () => ({ value: 'original' }),
        actions: {
          throwingAction() {
            throw new Error('sync action exploded')
          },
          secondAction() {
            secondActionSpy()
          },
        },
        lifecycleOptions: {
          refresh: {
            throwingAction: { params: [] },
            secondAction: { params: [] },
          },
        },
      })

      const refresh = mountWithRefresh(pinia)
      useThrowStore()

      expect(() => refresh({ mode: 'partial' })).toThrow('sync action exploded')
      expect(secondActionSpy).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when refresh function itself throws during invocation", () => {
    it("propagates the error — does not swallow it", () => {
      const useThrowingFnStore = defineStore('throwing-fn-refresh', {
        state: () => ({ value: 'original' }),
        actions: {
          fetch() { this.value = 'fetched' },
        },
        lifecycleOptions: {
          refresh: (): any => {
            throw new Error('refresh function exploded')
          },
        },
      })

      const refresh = mountWithRefresh(pinia)
      useThrowingFnStore()

      expect(() => refresh({ mode: 'partial' })).toThrow('refresh function exploded')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe("when enableDebugLogs is true", () => {
    it("logs the start of the refresh operation with mode and options", () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const refresh = mountWithRefresh(pinia, { enableDebugLogs: true })
      useUserStore()
      logSpy.mockClear()

      refresh({ mode: 'partial' })

      const allArgs = logSpy.mock.calls
        .flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('refresh')
      expect(allArgs).toContain('partial')
    })

    it("logs the filtering decision for each action", () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const refresh = mountWithRefresh(pinia, { enableDebugLogs: true })
      useUserStore()
      logSpy.mockClear()

      refresh({ mode: 'partial' })

      const allArgs = logSpy.mock.calls
        .flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('shouldInclude')
    })

    it("logs each executed action with its params", () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const refresh = mountWithRefresh(pinia, { enableDebugLogs: true })
      useUserStore()
      logSpy.mockClear()

      refresh({ mode: 'partial' })

      const allArgs = logSpy.mock.calls
        .flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('fetchProfile')
      expect(allArgs).toContain('params')
    })

    it("logs skip when no refresh options are defined", () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const refresh = mountWithRefresh(pinia, { enableDebugLogs: true })
      useEmptyStore()
      logSpy.mockClear()

      refresh({ mode: 'partial' })

      const allArgs = logSpy.mock.calls
        .flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('skipped')
    })

    it("logs skipped non-existent actions by name", () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const useGhostLogStore = defineStore('ghost-log', {
        state: () => ({ value: 'original' }),
        actions: {
          realAction() { this.value = 'real' },
        },
        lifecycleOptions: {
          refresh: {
            ghostAction: { params: [] } as any,
          },
        },
      })

      const refresh = mountWithRefresh(pinia, { enableDebugLogs: true })
      useGhostLogStore()
      logSpy.mockClear()

      refresh({ mode: 'partial' })

      const allArgs = logSpy.mock.calls
        .flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('ghostAction')
    })

    it("logs completion of the refresh operation", () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const refresh = mountWithRefresh(pinia, { enableDebugLogs: true })
      useUserStore()
      logSpy.mockClear()

      refresh({ mode: 'partial' })

      const allArgs = logSpy.mock.calls
        .flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('completed')
    })
  })
})
