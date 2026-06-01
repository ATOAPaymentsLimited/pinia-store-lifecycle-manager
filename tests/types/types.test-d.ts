import type { PiniaStoreLifecycleManagerRefreshOptions, PiniaCustomProperties } from '../../src/types'
import type { Ref } from 'vue'
import { defineStore } from 'pinia'

// Side-effect import to activate the module augmentation
import '../../src/types'

describe('lifecycleOptions — DefineStoreOptionsBase augmentation', () => {

  describe('options-style store — valid inputs accepted', () => {
    it('lifecycleOptions is accepted by defineStore as a valid option key', () => {
      defineStore('typed-store', {
        state: () => ({ name: 'Alice', count: 0 }),
        lifecycleOptions: {},
      })
    })

    it('clean accepts a partial object of valid state and getter keys', () => {
      defineStore('clean-state', {
        state: () => ({ name: 'Alice', count: 0 }),
        lifecycleOptions: { clean: { name: '' } },
      })
    })

    it('clean permits getter names — they are silently skipped at runtime by isReadonly', () => {
      defineStore('clean-getter', {
        state: () => ({ name: 'Alice' }),
        getters: { upper: (s) => s.name.toUpperCase() },
        lifecycleOptions: {
          // upper is a getter — TypeScript allows it, isReadonly skips at runtime
          clean: { upper: '' as any },
        },
      })
    })

    it('clean accepts an empty object — all keys are Partial, none required', () => {
      defineStore('clean-empty', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: { clean: {} },
      })
    })

    it('clean accepts a function that takes the store and returns a state partial', () => {
      defineStore('clean-fn', {
        state: () => ({ name: 'Alice', role: 'admin' }),
        lifecycleOptions: {
          clean: (store) => ({ name: `reset-${store.role}` }),
        },
      })
    })

    it('clean accepts a zero-argument function', () => {
      defineStore('clean-zero-arg', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          clean: () => ({ name: '' }),
        },
      })
    })

    it('reConfigure accepts a partial object of valid state and getter keys', () => {
      defineStore('rc-state', {
        state: () => ({ theme: 'light', lang: 'en' }),
        lifecycleOptions: { reConfigure: { theme: 'dark' } },
      })
    })

    it('reConfigure accepts a function that takes the store and returns a state partial', () => {
      defineStore('rc-fn', {
        state: () => ({ theme: 'light', role: 'user' }),
        lifecycleOptions: {
          reConfigure: (store) => ({ theme: store.role === 'admin' ? 'dark' : 'light' }),
        },
      })
    })

    it('refresh accepts an object mapping existing action names to typed params', () => {
      defineStore('refresh-obj', {
        state: () => ({ name: '' }),
        actions: { fetchProfile(id: string) { this.name = id } },
        lifecycleOptions: {
          refresh: { fetchProfile: { params: ['user-1'] } },
        },
      })
    })

    it('refresh params: [] is valid for a no-argument action', () => {
      defineStore('refresh-no-params', {
        state: () => ({ loaded: false }),
        actions: { load() { this.loaded = true } },
        lifecycleOptions: {
          refresh: { load: { params: [] } },
        },
      })
    })

    it('refresh params are typed strictly against the action\'s actual signature', () => {
      defineStore('refresh-typed-params', {
        state: () => ({ name: '' }),
        actions: { fetchProfile(id: string) { this.name = id } },
        lifecycleOptions: {
          refresh: { fetchProfile: { params: ['valid-string-id'] } },
        },
      })
    })

    it('disableListener is typed as boolean', () => {
      defineStore('disable-bool', {
        state: () => ({ v: 1 }),
        lifecycleOptions: { disableListener: true },
      })
    })
  })

  describe('options-style store — invalid inputs rejected', () => {
    it('clean rejects keys that do not exist in the store\'s state or getters', () => {
      defineStore('clean-bad-key', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          // @ts-expect-error — 'nonExistentKey' does not exist in state or getters
          clean: { nonExistentKey: '' },
        },
      })
    })

    it('refresh rejects action names that do not exist on the store', () => {
      defineStore('refresh-bad-action', {
        state: () => ({ name: '' }),
        actions: { fetchProfile(id: string) { this.name = id } },
        lifecycleOptions: {
          refresh: {
            // @ts-expect-error — 'nonExistentAction' is not an action on this store
            nonExistentAction: { params: [] },
          },
        },
      })
    })

    it('refresh rejects params with wrong argument types for a known action', () => {
      defineStore('refresh-wrong-params', {
        state: () => ({ name: '' }),
        actions: { fetchProfile(id: string) { this.name = id } },
        lifecycleOptions: {
          refresh: {
            // @ts-expect-error — fetchProfile expects string, not number
            fetchProfile: { params: [123] },
          },
        },
      })
    })

    it('disableListener rejects non-boolean values', () => {
      defineStore('disable-string', {
        state: () => ({ v: 1 }),
        lifecycleOptions: {
          // @ts-expect-error — 'yes' is not boolean
          disableListener: 'yes',
        },
      })
    })

    it('resetOnly rejects non-boolean values such as strings and numbers', () => {
      defineStore('reset-only-bad', {
        state: () => ({ name: '' }),
        actions: { fetchProfile(id: string) { this.name = id } },
        lifecycleOptions: {
          refresh: {
            fetchProfile: {
              params: ['id'],
              // @ts-expect-error — 'true' string is not boolean
              resetOnly: 'true',
            },
          },
        },
      })
    })
  })

  describe('PiniaStoreLifecycleManagerRefreshOptions', () => {
    it("mode only accepts 'full' or 'partial'", () => {
      const opts: PiniaStoreLifecycleManagerRefreshOptions = { mode: 'full' }
      expectTypeOf(opts.mode).toEqualTypeOf<'full' | 'partial'>()
    })

    it("mode rejects any string value other than 'full' or 'partial'", () => {
      // @ts-expect-error — 'incremental' is not a valid mode
      const _opts: PiniaStoreLifecycleManagerRefreshOptions = { mode: 'incremental' }
    })

    it('mode is required — omitting it is a TypeScript error', () => {
      // @ts-expect-error — mode is required
      const _opts: PiniaStoreLifecycleManagerRefreshOptions = {}
    })

    it('includeResetOnlyActions is an optional boolean', () => {
      const withFlag: PiniaStoreLifecycleManagerRefreshOptions = { mode: 'full', includeResetOnlyActions: true }
      expectTypeOf(withFlag.includeResetOnlyActions).toEqualTypeOf<boolean | undefined>()
    })
  })

  describe('CleanFunction store argument shape', () => {
    it('store argument does not expose $ prefixed Pinia internal properties', () => {
      defineStore('clean-arg-shape', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          clean: (store) => {
            // @ts-expect-error — $id is a Pinia internal, omitted from CleanFunction arg
            const _id = store.$id
            return {}
          },
        },
      })
    })

    it('store argument does not expose _hasStoreLifecycleManagerListener', () => {
      defineStore('clean-arg-no-listener', {
        state: () => ({ name: 'Alice' }),
        lifecycleOptions: {
          clean: (store) => {
            // @ts-expect-error — _hasStoreLifecycleManagerListener is omitted
            const _flag = store._hasStoreLifecycleManagerListener
            return {}
          },
        },
      })
    })

    it('store argument exposes regular state and action properties', () => {
      defineStore('clean-arg-has-state', {
        state: () => ({ name: 'Alice', count: 0 }),
        actions: { increment() { this.count++ } },
        lifecycleOptions: {
          clean: (store) => {
            expectTypeOf(store.name).toEqualTypeOf<string>()
            expectTypeOf(store.count).toEqualTypeOf<number>()
            return {}
          },
        },
      })
    })
  })

  describe('PiniaCustomProperties augmentation', () => {
    it('_hasStoreLifecycleManagerListener is Ref<boolean> | undefined on any store', () => {
      expectTypeOf<PiniaCustomProperties['_hasStoreLifecycleManagerListener']>().toEqualTypeOf<Ref<boolean> | undefined>()
    })
  })
})
