import { vi } from 'vitest'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { PiniaStoreLifecycleManager } from '../../src/plugin'
import { setupPinia, useUserStore, useReadonlyStore, useNestedStore, useEmptyStore } from '../helpers/store-factory'

/**
 * Registers the plugin on the given pinia instance and captures the reset() function
 * that is passed to the lifecycleEventHandler.
 */
function mountWithReset(pinia: ReturnType<typeof createPinia>, opts?: { enableDebugLogs?: boolean }) {
  let capturedReset: (() => void) | undefined
  pinia.use((ctx) =>
    PiniaStoreLifecycleManager(ctx, ({ reset }) => {
      capturedReset = reset
    }, opts)
  )
  return () => capturedReset!()
}

describe('PiniaStoreLifecycleManager — reset()', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = setupPinia()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when no clean options are defined on the store', () => {
    it('skips the reset operation without throwing', () => {
      const getReset = mountWithReset(pinia)
      useEmptyStore()
      expect(() => getReset()).not.toThrow()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when clean is a plain object', () => {
    it('resets specified state properties to their defined values', () => {
      const getReset = mountWithReset(pinia)
      const store = useUserStore()
      store.name = 'Charlie'
      store.token = 'tok999'
      getReset()
      expect(store.name).toBe('')
      expect(store.token).toBe('')
    })

    it('does not modify properties absent from the clean object', () => {
      const getReset = mountWithReset(pinia)
      const store = useNestedStore()
      // 'profile' and 'tags' are in clean, but if we only had a partial clean, absent props stay
      // Use a store that only defines clean for a subset of its state
      const usePartialStore = defineStore('partial-clean', {
        state: () => ({ a: 'original-a', b: 'original-b' }),
        lifecycleOptions: {
          clean: { a: 'reset-a' }, // 'b' is absent
        },
      })
      const partial = usePartialStore()
      partial.a = 'changed-a'
      partial.b = 'changed-b'
      getReset() // this reset is for the nested store captured first; instantiate partial separately
      // Need a fresh reset for the partial store
      const pinia2 = setupPinia()
      let capturedReset2: (() => void) | undefined
      pinia2.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset2 = reset })
      )
      const partial2 = usePartialStore()
      partial2.a = 'changed-a'
      partial2.b = 'changed-b'
      capturedReset2!()
      expect(partial2.a).toBe('reset-a')
      expect(partial2.b).toBe('changed-b')
    })

    it('resets multiple properties in a single call', () => {
      const getReset = mountWithReset(pinia)
      const store = useUserStore()
      store.name = 'Bob'
      store.token = 'xyz'
      store.role = 'admin'
      store.count = 99
      getReset()
      expect(store.name).toBe('')
      expect(store.token).toBe('')
      expect(store.role).toBe('guest')
      expect(store.count).toBe(0)
    })

    it('sets a property to null without throwing', () => {
      const useNullStore = defineStore('nullable-reset', {
        state: () => ({ user: 'Alice' as string | null }),
        lifecycleOptions: {
          clean: { user: null },
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useNullStore()
      expect(() => capturedReset!()).not.toThrow()
      expect(store.user).toBeNull()
    })

    it('sets a property to undefined without throwing', () => {
      const useUndefinedStore = defineStore('undefined-reset', {
        state: () => ({ label: 'hello' as string | undefined }),
        lifecycleOptions: {
          clean: { label: undefined },
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useUndefinedStore()
      expect(() => capturedReset!()).not.toThrow()
      expect(store.label).toBeUndefined()
    })

    it('applies falsy values (0, false, empty string) — they are not skipped', () => {
      const getReset = mountWithReset(pinia)
      const store = useUserStore()
      store.name = 'Alice'
      store.count = 42
      getReset()
      expect(store.name).toBe('')   // empty string
      expect(store.count).toBe(0)   // zero
    })

    it('replaces an array property with a new empty array', () => {
      const getReset = mountWithReset(pinia)
      const store = useUserStore()
      store.items = ['x', 'y', 'z']
      getReset()
      expect(store.items).toEqual([])
    })

    it('replaces a nested object property entirely (shallow — does not deep merge)', () => {
      const getReset = mountWithReset(pinia)
      const store = useNestedStore()
      store.profile = { name: 'Alice', age: 30, extra: 'shouldBeGone' }
      getReset()
      // clean.profile is { name: 'reset' } — extra keys like 'age' should be gone
      expect(store.profile).toEqual({ name: 'reset' })
      expect((store.profile as any).age).toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when clean is an empty object', () => {
    it('runs without error and modifies no state properties', () => {
      const useEmptyCleanStore = defineStore('empty-clean', {
        state: () => ({ x: 'hello', y: 42 }),
        lifecycleOptions: {
          clean: {},
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useEmptyCleanStore()
      store.x = 'changed'
      store.y = 100
      expect(() => capturedReset!()).not.toThrow()
      expect(store.x).toBe('changed')
      expect(store.y).toBe(100)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when clean is a function that takes the store as an argument', () => {
    it('calls the function with the current store instance', () => {
      const cleanFn = vi.fn((store: any) => ({ name: 'reset-from-fn' }))
      const useFnArgStore = defineStore('fn-arg-store', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          clean: cleanFn,
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useFnArgStore()
      capturedReset!()
      expect(cleanFn).toHaveBeenCalledWith(store)
    })

    it('resets properties to the values returned by the function', () => {
      const useFnReturnStore = defineStore('fn-return-store', {
        state: () => ({ name: 'Alice', count: 5 }),
        lifecycleOptions: {
          clean: (_store: any) => ({ name: 'fn-reset', count: -1 }),
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useFnReturnStore()
      capturedReset!()
      expect(store.name).toBe('fn-reset')
      expect(store.count).toBe(-1)
    })

    it('reads store state at the time reset() is called — not at definition time', () => {
      // The function receives the live store, so it can inspect current state
      const useDynamicStore = defineStore('fn-dynamic-store', {
        state: () => ({ flag: false, label: 'initial' }),
        lifecycleOptions: {
          clean: (store: any) => ({
            label: store.flag ? 'was-true' : 'was-false',
          }),
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useDynamicStore()
      store.flag = true
      capturedReset!()
      expect(store.label).toBe('was-true')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when clean is a zero-argument function', () => {
    it('calls the function with no arguments', () => {
      const cleanFn = vi.fn(() => ({ name: 'zero-arg-reset' }))
      const useZeroArgStore = defineStore('zero-arg-store', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          clean: cleanFn,
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      useZeroArgStore()
      capturedReset!()
      // zero-arg function: Function.length === 0, so called with no args
      expect(cleanFn).toHaveBeenCalledWith()
    })

    it('resets properties to the values returned by the function', () => {
      const useZeroReturnStore = defineStore('zero-return-store', {
        state: () => ({ value: 'original' }),
        lifecycleOptions: {
          clean: () => ({ value: 'from-zero-arg' }),
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useZeroReturnStore()
      store.value = 'changed'
      capturedReset!()
      expect(store.value).toBe('from-zero-arg')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when clean is a function with a default parameter value', () => {
    it('is treated as a zero-argument function — store arg is not passed (Function.length = 0)', () => {
      // (store = {} as any) => {} has Function.length === 0
      const cleanFn = vi.fn((store = {} as any) => ({ name: 'default-param-reset' }))
      expect(cleanFn.length).toBe(0) // confirm our understanding
      const useDefaultParamStore = defineStore('default-param-store', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          clean: cleanFn,
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const storeInstance = useDefaultParamStore()
      capturedReset!()
      // Because length === 0, the plugin calls it with no arguments
      // The spy's first call arg should be undefined (no arg passed)
      const callArg = cleanFn.mock.calls[0][0]
      expect(callArg).toBeUndefined()
      expect(storeInstance.name).toBe('default-param-reset')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when clean is a function that returns void', () => {
    it('skips the reset loop without throwing', () => {
      const useVoidFnStore = defineStore('void-fn-store', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          clean: (): void => { /* returns nothing */ },
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useVoidFnStore()
      store.name = 'Changed'
      expect(() => capturedReset!()).not.toThrow()
      // name should remain unchanged since cleanOptions is undefined/void
      expect(store.name).toBe('Changed')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when clean function itself throws during invocation', () => {
    it('propagates the error — does not swallow it', () => {
      const useThrowingFnStore = defineStore('throwing-fn-store', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          clean: (): any => { throw new Error('clean function exploded') },
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      useThrowingFnStore()
      expect(() => capturedReset!()).toThrow('clean function exploded')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when a property in clean options is readonly', () => {
    describe('when enableDebugLogs is true', () => {
      it('skips the readonly property and emits a non-writable warning', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        let capturedReset: (() => void) | undefined
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset }, { enableDebugLogs: true })
        )
        const store = useReadonlyStore()
        store.name = 'Changed'
        capturedReset!()
        expect(warnSpy).toHaveBeenCalled()
        const allWarnArgs = warnSpy.mock.calls.flat().join(' ')
        expect(allWarnArgs).toContain('fullLabel')
        // The writable property should still be reset
        expect(store.name).toBe('')
      })
    })

    describe('when enableDebugLogs is false', () => {
      it('silently skips the readonly property without logging', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        let capturedReset: (() => void) | undefined
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset }, { enableDebugLogs: false })
        )
        const store = useReadonlyStore()
        store.name = 'Changed'
        expect(() => capturedReset!()).not.toThrow()
        // devWarnNonWritable (our custom warn) should NOT be called when enableDebugLogs is false
        const customWarnCalls = warnSpy.mock.calls.filter(
          (args) => typeof args[0] === 'string' && args[0].includes('non-writable')
        )
        expect(customWarnCalls).toHaveLength(0)
        // The writable property should still be reset
        expect(store.name).toBe('')
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when clean options include a getter (computed) property name', () => {
    it('the getter is skipped by the isReadonly guard at runtime', () => {
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useReadonlyStore()
      store.name = 'Changed'
      expect(() => capturedReset!()).not.toThrow()
      // fullLabel is a computed getter — isReadonly returns true, so it is skipped
      // name is writable and should have been reset to ''
      expect(store.name).toBe('')
      // fullLabel should reflect the reset name, not the 'Label: ' from clean
      expect(store.fullLabel).toBe('Label: ')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when property assignment throws an error', () => {
    it('catches the error and calls devError', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const useBadPropStore = defineStore('bad-prop-store', {
        state: () => ({ goodProp: 'ok', badProp: 'bad' }),
        lifecycleOptions: {
          clean: { goodProp: 'reset', badProp: 'shouldThrow' },
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useBadPropStore()
      Object.defineProperty(store, 'badProp', {
        set() { throw new Error('cannot set badProp') },
        get() { return 'bad' },
        configurable: true,
      })
      capturedReset!()
      expect(errorSpy).toHaveBeenCalled()
    })

    it('devError fires regardless of the enableDebugLogs setting', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const useBadPropStore2 = defineStore('bad-prop-store-2', {
        state: () => ({ goodProp: 'ok', badProp: 'bad' }),
        lifecycleOptions: {
          clean: { goodProp: 'reset', badProp: 'shouldThrow' },
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset }, { enableDebugLogs: false })
      )
      const store = useBadPropStore2()
      Object.defineProperty(store, 'badProp', {
        set() { throw new Error('cannot set badProp') },
        get() { return 'bad' },
        configurable: true,
      })
      capturedReset!()
      expect(errorSpy).toHaveBeenCalled()
    })

    it('continues resetting remaining properties after the error', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const useContinueStore = defineStore('continue-after-error', {
        state: () => ({ a: 'original-a', b: 'original-b', c: 'original-c' }),
        lifecycleOptions: {
          clean: { a: 'reset-a', b: 'shouldThrow', c: 'reset-c' },
        },
      })
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset })
      )
      const store = useContinueStore()
      Object.defineProperty(store, 'b', {
        set() { throw new Error('cannot set b') },
        get() { return 'still-original-b' },
        configurable: true,
      })
      store.a = 'changed-a'
      store.c = 'changed-c'
      capturedReset!()
      expect(store.a).toBe('reset-a')
      expect(store.c).toBe('reset-c')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when reset() is called multiple times', () => {
    it('produces the same final state on every call — idempotent', () => {
      const getReset = mountWithReset(pinia)
      const store = useUserStore()
      store.name = 'Bob'
      store.token = 'xyz'
      store.count = 99
      getReset()
      const stateAfterFirst = { name: store.name, token: store.token, count: store.count }
      store.name = 'Charlie'
      store.token = 'abc'
      store.count = 50
      getReset()
      expect(store.name).toBe(stateAfterFirst.name)
      expect(store.token).toBe(stateAfterFirst.token)
      expect(store.count).toBe(stateAfterFirst.count)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  describe('when enableDebugLogs is true', () => {
    it('logs the start of the reset operation with clean options', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset }, { enableDebugLogs: true })
      )
      useUserStore()
      logSpy.mockClear()
      capturedReset!()
      const allArgs = logSpy.mock.calls.flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('reset state operation')
    })

    it('logs each property update showing old and new values', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset }, { enableDebugLogs: true })
      )
      const store = useUserStore()
      store.name = 'ChangedName'
      logSpy.mockClear()
      capturedReset!()
      const allArgs = logSpy.mock.calls.flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      // Should log oldValue and newValue for 'name'
      expect(allArgs).toContain('name')
      expect(allArgs).toContain('oldValue')
      expect(allArgs).toContain('newValue')
    })

    it('logs completion of the reset operation', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset }, { enableDebugLogs: true })
      )
      useUserStore()
      logSpy.mockClear()
      capturedReset!()
      const allArgs = logSpy.mock.calls.flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('completed')
    })

    it('logs skip message when no clean options are defined', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      let capturedReset: (() => void) | undefined
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, ({ reset }) => { capturedReset = reset }, { enableDebugLogs: true })
      )
      useEmptyStore()
      logSpy.mockClear()
      capturedReset!()
      const allArgs = logSpy.mock.calls.flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('skipped')
    })
  })
})
