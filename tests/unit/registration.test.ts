import { vi } from 'vitest'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { PiniaStoreLifecycleManager } from '../../src/plugin'
import { setupPinia, useUserStore, useDisabledStore, useEmptyStore } from '../helpers/store-factory'

describe('PiniaStoreLifecycleManager — Listener Registration', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = setupPinia()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when running in a client-side environment', () => {
    describe('when disableAutoRegister is false (default)', () => {
      describe('when disableListener is not set', () => {
        it('registers the lifecycle listener on the store', () => {
          const handler = vi.fn()
          pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, handler))
          useUserStore()
          expect(handler).toHaveBeenCalledOnce()
        })

        it('adds _hasStoreLifecycleManagerListener to store.$state', () => {
          pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, () => {}))
          const store = useUserStore()
          expect(store.$state).toHaveProperty('_hasStoreLifecycleManagerListener')
        })

        it('exposes _hasStoreLifecycleManagerListener as a reactive Ref on the store instance', () => {
          pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, () => {}))
          const store = useUserStore()
          expect(store._hasStoreLifecycleManagerListener).toBeDefined()
          // In Pinia v3, refs in reactive state are auto-unwrapped to their values
          expect(store._hasStoreLifecycleManagerListener).toBe(true)
        })
      })

      describe('when disableListener is false (explicit)', () => {
        it('registers the lifecycle listener', () => {
          const handler = vi.fn()
          pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, handler))
          useUserStore()
          expect(handler).toHaveBeenCalledOnce()
        })
      })

      describe('when disableListener is true', () => {
        it('skips listener registration', () => {
          const handler = vi.fn()
          pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, handler))
          useDisabledStore()
          expect(handler).not.toHaveBeenCalled()
        })
      })
    })

    describe('when disableAutoRegister is true', () => {
      describe('when disableListener is false (explicit opt-in)', () => {
        it('registers the lifecycle listener', async () => {
          const useOptInStore = defineStore('opt-in', {
            state: () => ({ v: 1 }),
            lifecycleOptions: { disableListener: false, clean: { v: 0 } },
          })
          const handler = vi.fn()
          pinia.use((ctx) =>
            PiniaStoreLifecycleManager(ctx, handler, { disableAutoRegister: true })
          )
          useOptInStore()
          expect(handler).toHaveBeenCalledOnce()
        })
      })

      describe('when disableListener is true (explicit opt-out)', () => {
        it('skips listener registration', () => {
          const handler = vi.fn()
          pinia.use((ctx) =>
            PiniaStoreLifecycleManager(ctx, handler, { disableAutoRegister: true })
          )
          useDisabledStore()
          expect(handler).not.toHaveBeenCalled()
        })
      })

      describe('when disableListener is undefined (not opted in)', () => {
        it('skips listener registration', () => {
          const handler = vi.fn()
          pinia.use((ctx) =>
            PiniaStoreLifecycleManager(ctx, handler, { disableAutoRegister: true })
          )
          useUserStore()
          expect(handler).not.toHaveBeenCalled()
        })
      })
    })

    describe('when the listener is already registered', () => {
      it('does not register a duplicate listener', () => {
        let callCount = 0
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, () => {
            callCount++
          })
        )
        useUserStore()
        useUserStore()
        expect(callCount).toBe(1)
      })

      it('does not invoke the lifecycleEventHandler a second time', () => {
        const handler = vi.fn()
        pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, handler))
        useUserStore()
        useUserStore()
        useUserStore()
        expect(handler).toHaveBeenCalledOnce()
      })
    })

    describe('when no pluginOptions are passed at all', () => {
      it('registers the listener with default behaviour', () => {
        const handler = vi.fn()
        pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, handler))
        useUserStore()
        expect(handler).toHaveBeenCalledOnce()
      })

      it('does not throw when pluginOptions is undefined', () => {
        expect(() => {
          pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, () => {}))
          useUserStore()
        }).not.toThrow()
      })
    })

    describe('when lifecycleEventHandler calls reset() synchronously during registration', () => {
      it('executes the reset on the freshly registered store without error', () => {
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, ({ reset }) => {
            reset()
          })
        )
        const store = useUserStore()
        expect(store.name).toBe('')
        expect(store.token).toBe('')
      })
    })

    describe('when lifecycleEventHandler itself throws', () => {
      it('propagates the error to the caller without swallowing it', () => {
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, () => {
            throw new Error('handler error')
          })
        )
        expect(() => useUserStore()).toThrow('handler error')
      })
    })

    describe('when lifecycleEventHandler is an async function', () => {
      it('does not await the handler — registration completes synchronously', () => {
        let asyncResolved = false
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, async () => {
            await new Promise((r) => setTimeout(r, 10))
            asyncResolved = true
          })
        )
        useUserStore()
        expect(asyncResolved).toBe(false)
      })

      it('event bindings set up inside async handler fire after registration completes', async () => {
        let resetFn: (() => void) | undefined
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, async ({ reset }) => {
            await Promise.resolve()
            resetFn = reset
          })
        )
        useUserStore()
        await Promise.resolve()
        expect(resetFn).toBeDefined()
      })
    })
  })

  describe('when running in an SSR environment', () => {
    let savedWindow: any
    let savedDocument: any

    beforeEach(() => {
      savedWindow = (globalThis as any).window
      savedDocument = (globalThis as any).document
    })

    afterEach(() => {
      ;(globalThis as any).window = savedWindow
      ;(globalThis as any).document = savedDocument
    })

    describe('when window is undefined and document is undefined', () => {
      describe('when enableSSR is false (default)', () => {
        it('skips listener registration entirely', () => {
          delete (globalThis as any).window
          delete (globalThis as any).document

          const handler = vi.fn()
          pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, handler))
          useUserStore()
          expect(handler).not.toHaveBeenCalled()
        })

        it('does not invoke the lifecycleEventHandler', () => {
          delete (globalThis as any).window

          const handler = vi.fn()
          pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, handler))
          useUserStore()
          expect(handler).not.toHaveBeenCalled()
        })
      })

      describe('when enableSSR is true', () => {
        it('registers the lifecycle listener on the server', () => {
          delete (globalThis as any).window
          delete (globalThis as any).document

          const handler = vi.fn()
          pinia.use((ctx) =>
            PiniaStoreLifecycleManager(ctx, handler, { enableSSR: true })
          )
          useUserStore()
          expect(handler).toHaveBeenCalledOnce()
        })
      })
    })

    describe('when window exists but document is undefined', () => {
      it('treats the environment as SSR and skips registration', () => {
        delete (globalThis as any).document

        const handler = vi.fn()
        pinia.use((ctx) => PiniaStoreLifecycleManager(ctx, handler))
        useUserStore()
        expect(handler).not.toHaveBeenCalled()
      })
    })

    describe('when enableSSR is true but window and document both exist (client)', () => {
      it('proceeds with registration — enableSSR flag has no effect on the client', () => {
        const handler = vi.fn()
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, handler, { enableSSR: true })
        )
        useUserStore()
        expect(handler).toHaveBeenCalledOnce()
      })
    })
  })

  describe('when enableDebugLogs is true', () => {
    it('logs listener attachment message with correct store.$id', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, () => {}, { enableDebugLogs: true })
      )
      useUserStore()
      const allArgs = spy.mock.calls.flat().join(' ')
      expect(allArgs).toContain('[user]')
    })

    it("logs skip reason 'Already attached' when duplicate registration is attempted", () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      // Register the plugin twice — the second run will find it already attached
      const pluginFn = (ctx: any) =>
        PiniaStoreLifecycleManager(ctx, () => {}, { enableDebugLogs: true })
      pinia.use(pluginFn)
      pinia.use(pluginFn)
      useUserStore()
      const allArgs = spy.mock.calls.flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('Already attached')
    })

    it("logs skip reason 'Disabled by configuration' when disabled by config", () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      pinia.use((ctx) =>
        PiniaStoreLifecycleManager(ctx, () => {}, { enableDebugLogs: true })
      )
      useDisabledStore()
      const allArgs = spy.mock.calls.flat()
        .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ')
      expect(allArgs).toContain('Disabled by configuration')
    })

    it('logs SSR skip message', () => {
      const savedWindow = (globalThis as any).window
      const savedDocument = (globalThis as any).document
      try {
        delete (globalThis as any).window
        delete (globalThis as any).document

        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        pinia.use((ctx) =>
          PiniaStoreLifecycleManager(ctx, () => {}, { enableDebugLogs: true })
        )
        useUserStore()
        const allArgs = spy.mock.calls.flat().join(' ')
        expect(allArgs).toContain('not running on the client side')
      } finally {
        ;(globalThis as any).window = savedWindow
        ;(globalThis as any).document = savedDocument
      }
    })
  })
})
