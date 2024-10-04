import type { StoreActions, StoreGetters, StoreState } from "pinia";
import { Ref } from "vue";

/**
 * Represents a map of action parameters for a store.
 * Each key is an action name, and the value contains the action's parameters and a flag indicating if it's reset-only.
 */
export type ActionParamsMap<T> = {
  [K in keyof T]: {
    params: T[K] extends (...args: infer P) => unknown ? P : [];
    resetOnly?: boolean;
  };
};

/**
 * Options for refreshing a Pinia store using the lifecycle manager.
 */
export type PiniaStoreLifecycleManagerRefreshOptions = {
  /** The refresh mode: 'full' refreshes all actions, 'partial' skips reset-only actions */
  mode: "full" | "partial";
  /** Whether to include reset-only actions in 'full' mode */
  includeResetOnlyActions?: boolean;
};

/**
 * Represents the options for cleaning a store's state.
 * Omits the internal '_hasStoreLifecycleManagerListener' property.
 */
export type CleanOptions<Store> = Partial<
  Omit<
    StoreState<Store> & StoreGetters<Store>,
    "_hasStoreLifecycleManagerListener"
  >
>;

/**
 * Represents the options for reconfiguring a store's state.
 * Omits the internal '_hasStoreLifecycleManagerListener' property.
 */
export type ReconfigureOptions<Store> = Partial<
  Omit<
    StoreState<Store> & StoreGetters<Store>,
    "_hasStoreLifecycleManagerListener"
  >
>;

/**
 * A function that takes a store and returns clean options or void.
 */
export type CleanFunction<Store> = (
  store: Omit<
    Store,
    `$${string}` | `_customProperties` | "_hasStoreLifecycleManagerListener"
  >
) => CleanOptions<Store> | void;

/**
 * A function that takes a store and returns reconfigure options or void.
 */
export type ReconfigureFunction<Store> = (
  store: Omit<
    Store,
    `$${string}` | `_customProperties` | "_hasStoreLifecycleManagerListener"
  >
) => ReconfigureOptions<Store> | void;

/**
 * Represents the options for refreshing a store's actions.
 */
export type RefreshOptions<Store> = Partial<
  ActionParamsMap<StoreActions<Store>>
>;

/**
 * A function that takes a store and returns refresh options or void.
 */
export type RefreshFunction<Store> = (
  store: Omit<
    Store,
    `$${string}` | `_customProperties` | "_hasStoreLifecycleManagerListener"
  >
) => RefreshOptions<Store> | void;

// Extend Pinia's types to include our custom properties and options
declare module "pinia" {
  export interface PiniaCustomProperties {
    _hasStoreLifecycleManagerListener?: Ref<boolean>;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface DefineStoreOptionsBase<S extends StateTree, Store> {
    lifecycleOptions?: {
      /**
       * Defines properties to be reset during a hard-reset operation.
       */
      clean?:
        | CleanOptions<Store>
        | CleanFunction<Store>
        | (() => CleanOptions<Store> | void);
      /**
       * Defines properties to be reset during a soft-reset (reconfigure) operation.
       */
      reConfigure?:
        | ReconfigureOptions<Store>
        | ReconfigureFunction<Store>
        | (() => ReconfigureOptions<Store> | void);
      /**
       * Defines actions to be called during a refresh operation.
       * @param v - The store instance with certain properties omitted.
       * @returns Partial map of action parameters.
       */
      refresh?:
        | RefreshOptions<Store>
        | RefreshFunction<Store>
        | (() => RefreshOptions<Store> | void);
      /**
       * Controls the automatic registration of the listener.
       * - For automatic registration: set to true to disable listener registration.
       * - For manual registration: set to false to enable listener registration.
       */
      disableListener?: boolean;
    };
  }
}
