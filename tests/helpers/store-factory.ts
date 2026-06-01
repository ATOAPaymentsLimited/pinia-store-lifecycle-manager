import { createPinia, defineStore, setActivePinia } from 'pinia'
import { createApp, ref } from 'vue'

/**
 * Call this in beforeEach to get a clean Pinia instance per test.
 * Creates a minimal Vue app and installs pinia so that plugins registered
 * via pinia.use() are immediately active (required by Pinia v3).
 */
export function setupPinia() {
  const pinia = createPinia()
  const app = createApp({})
  app.use(pinia)
  setActivePinia(pinia)
  return pinia
}

/**
 * Main store: used for most reset, reconfigure, refresh, and integration tests.
 * Has state, actions, and all three lifecycleOptions set.
 */
export const useUserStore = defineStore('user', {
  state: () => ({
    name: 'Alice',
    token: 'abc123',
    role: 'admin',
    count: 0,
    items: ['a', 'b'] as string[],
    preferences: { theme: 'light', lang: 'en' } as Record<string, string>,
  }),
  actions: {
    fetchProfile(id: string) {
      this.name = id
    },
    fetchSettings() {
      this.token = 'refreshed'
    },
    fetchPermissions(role: string) {
      this.role = role
    },
  },
  lifecycleOptions: {
    clean: {
      name: '',
      token: '',
      role: 'guest',
      count: 0,
      items: [],
      preferences: {},
    },
    reConfigure: {
      name: 'NewUser',
      role: 'viewer',
    },
    refresh: {
      fetchProfile: { params: ['default-id'] },
      fetchSettings: { params: [] },
      fetchPermissions: { params: ['viewer'], resetOnly: true },
    },
  },
})

/**
 * Store with a computed (readonly) getter.
 * Used to test the isReadonly guard in reset/reconfigure.
 */
export const useReadonlyStore = defineStore('readonly', {
  state: () => ({
    name: 'Base',
  }),
  getters: {
    fullLabel: (state) => `Label: ${state.name}`,
  },
  lifecycleOptions: {
    // 'fullLabel' is a getter — isReadonly guard should skip it at runtime
    clean: {
      name: '',
      fullLabel: 'Label: ' as any,
    },
  },
})

/**
 * Store with disableListener: true.
 * Used to test that opt-out stores are skipped.
 */
export const useDisabledStore = defineStore('disabled', {
  state: () => ({
    value: 'original',
  }),
  lifecycleOptions: {
    disableListener: true,
    clean: { value: 'cleaned' },
  },
})

/**
 * Store with no lifecycleOptions at all.
 * Used to test no-op / skip paths.
 */
export const useEmptyStore = defineStore('empty', {
  state: () => ({
    value: 'unchanged',
  }),
})

/**
 * Store with a nested object and array in state.
 * Used to test shallow assignment behavior.
 */
export const useNestedStore = defineStore('nested', {
  state: () => ({
    profile: { name: 'Alice', age: 30 } as Record<string, unknown>,
    tags: ['x', 'y', 'z'] as string[],
  }),
  lifecycleOptions: {
    clean: {
      profile: { name: 'reset' },
      tags: [],
    },
  },
})

/**
 * Setup-style store (composition API).
 * Used for type-level tests to verify lifecycleOptions works in setup stores.
 */
export const useSetupStore = defineStore(
  'setup',
  () => {
    const data = ref<string | null>(null)
    function fetchData(id: string) {
      data.value = id
    }
    return { data, fetchData }
  },
  {
    lifecycleOptions: {
      refresh: {
        fetchData: { params: ['setup-id'] },
      },
    },
  }
)
