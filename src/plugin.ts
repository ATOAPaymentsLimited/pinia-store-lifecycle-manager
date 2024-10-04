import type { PiniaPluginContext, Store, StoreActions } from "pinia";
import { debugLog, devWarnNonWritable, devError } from "./utils";
import {
  PiniaStoreLifecycleManagerRefreshOptions,
  CleanOptions,
  ReconfigureOptions,
  RefreshOptions,
} from "./types";
import { ref, toRef, isReadonly } from "vue";

/**
 * PiniaStoreLifecycleManager: A Pinia plugin for managing store lifecycle, including state resets and refreshes.
 *
 * @param context - The Pinia plugin context.
 * @param lifecycleEventHandler - The listener function to be called for various lifecycle events.
 * @param pluginOptions - Configuration options for the plugin.
 */
export const PiniaStoreLifecycleManager = (
  { options, store }: PiniaPluginContext,
  lifecycleEventHandler: (events: {
    /**
     * Resets the store to its initial state.
     * Use this when you need to completely clear the store, e.g., on user logout.
     */
    reset: () => void;

    /**
     * Reconfigures the store with new values.
     * Use this when you need to update multiple store properties at once,
     * e.g., when switching to a different configuration or context.
     */
    reconfigure: () => void;

    /**
     * Refreshes the store data by calling specified actions.
     * @param options RefreshOptions to control the refresh behavior.
     *
     * Use 'full' mode when you need to refresh all data, including reset-only actions.
     * This is useful for major state changes, like switching user accounts.
     *
     * Use 'partial' mode for routine updates or when switching to a related context
     * that doesn't require a full data refresh.
     */
    refresh: (options: PiniaStoreLifecycleManagerRefreshOptions) => void;
  }) => void,
  pluginOptions?: {
    /**
     * Disables the automatic registration of lifecycle listeners.
     * Set to true to manually manage lifecycle listener registration.
     */
    disableAutoRegister?: boolean;

    /**
     * Enables debug logging for the PiniaStoreLifecycleManager.
     * Set to true to output debug information to the console.
     */
    enableDebugLogs?: boolean;

    /**
     * Enables server-side rendering support for the PiniaStoreLifecycleManager.
     * Set to true if the application uses SSR to ensure proper lifecycle management.
     *
     * **Note:** Only enable if you are sure that your listener works perfectly in SSR,
     * as this plugin only assigns the listener once either on the server or on the client.
     */
    enableSSR?: boolean;
  }
) => {
  // Check if running in a client-side environment
  if (
    (typeof window === "undefined" || typeof document === "undefined") &&
    !pluginOptions?.enableSSR
  ) {
    if (pluginOptions?.enableDebugLogs) {
      debugLog(
        store.$id,
        "PiniaStoreLifecycleManager is not running on the client side."
      );
    }
    return; // Exit if not in a client-side environment
  }

  if (
    !store.$state.hasOwnProperty("hasStoreLifecycleManagerListener") &&
    ((!pluginOptions?.disableAutoRegister &&
      options.lifecycleOptions?.disableListener !== true) ||
      (pluginOptions?.disableAutoRegister &&
        options.lifecycleOptions?.disableListener === false))
  ) {
    const _hasStoreLifecycleManagerListener = ref(true);

    store.$state._hasStoreLifecycleManagerListener =
      _hasStoreLifecycleManagerListener;

    if (pluginOptions?.enableDebugLogs) {
      debugLog(store.$id, "Attaching PiniaStoreLifecycleManager listener");
    }

    lifecycleEventHandler({
      reset: resetState,
      reconfigure: reconfigureState,
      refresh: refreshState,
    });

    store._hasStoreLifecycleManagerListener = toRef(
      store.$state,
      "_hasStoreLifecycleManagerListener"
    );

    if (pluginOptions?.enableDebugLogs) {
      debugLog(
        store.$id,
        "PiniaStoreLifecycleManager listener attached successfully"
      );
    }
  } else {
    if (pluginOptions?.enableDebugLogs) {
      debugLog(
        store.$id,
        "Skipping PiniaStoreLifecycleManager listener attachment",
        {
          reason: store.$state.hasStoreLifecycleManagerListener
            ? "Already attached"
            : "Disabled by configuration",
        }
      );
    }
  }

  /**
   * Resets the store state based on the clean options.
   */
  function resetState() {
    if (pluginOptions?.enableDebugLogs) {
      debugLog(
        store.$id,
        "Initiating reset state operation",
        options.lifecycleOptions?.clean
      );
    }

    if (!options.lifecycleOptions?.clean) {
      if (pluginOptions?.enableDebugLogs) {
        debugLog(
          store.$id,
          "Reset state operation skipped: No clean options defined"
        );
      }
      return;
    }

    const cleanOptions: CleanOptions<Store> | undefined =
      typeof options.lifecycleOptions.clean === "function"
        ? options.lifecycleOptions.clean.length > 0
          ? options.lifecycleOptions.clean(store)
          : (
              options.lifecycleOptions.clean as () => CleanOptions<Store> | void
            )()
        : options.lifecycleOptions.clean;

    if (cleanOptions) {
      Object.keys(cleanOptions).forEach((key) => {
        if (isReadonly(store[key])) {
          if (pluginOptions?.enableDebugLogs) {
            devWarnNonWritable(store.$id, key);
          }
          return;
        }

        const oldValue = store[key];
        try {
          store[key] = cleanOptions[key as keyof typeof cleanOptions];
          if (pluginOptions?.enableDebugLogs) {
            debugLog(store.$id, `Reset state: Updated '${key}'`, {
              oldValue,
              newValue: store[key],
            });
          }
        } catch (error) {
          devError(store.$id, `Failed to reset state for key '${key}'`, error);
        }
      });
    }

    if (pluginOptions?.enableDebugLogs) {
      debugLog(store.$id, "Reset state operation completed");
    }
  }

  /**
   * Reconfigures the store state based on the reconfigure options.
   */
  function reconfigureState() {
    if (pluginOptions?.enableDebugLogs) {
      debugLog(
        store.$id,
        "Initiating reconfigure state operation",
        options.lifecycleOptions?.reConfigure
      );
    }

    if (!options.lifecycleOptions?.reConfigure) {
      if (pluginOptions?.enableDebugLogs) {
        debugLog(
          store.$id,
          "Reconfigure state operation skipped: No reconfigure options defined"
        );
      }
      return;
    }

    const reconfigureOptions: ReconfigureOptions<Store> | undefined =
      typeof options.lifecycleOptions.reConfigure === "function"
        ? options.lifecycleOptions.reConfigure.length > 0
          ? options.lifecycleOptions.reConfigure(store)
          : (
              options.lifecycleOptions
                .reConfigure as () => ReconfigureOptions<Store> | void
            )()
        : options.lifecycleOptions.reConfigure;

    if (reconfigureOptions) {
      Object.keys(reconfigureOptions).forEach((key) => {
        if (isReadonly(store[key])) {
          if (pluginOptions?.enableDebugLogs) {
            devWarnNonWritable(store.$id, key);
          }
          return;
        }

        const oldValue = store[key];
        try {
          store[key] =
            reconfigureOptions[key as keyof typeof reconfigureOptions];
          if (pluginOptions?.enableDebugLogs) {
            debugLog(store.$id, `Reconfigure state: Updated '${key}'`, {
              oldValue,
              newValue: store[key],
            });
          }
        } catch (error) {
          devError(
            store.$id,
            `Failed to reconfigure state for key '${key}'`,
            error
          );
        }
      });
    }

    if (pluginOptions?.enableDebugLogs) {
      debugLog(store.$id, "Reconfigure state operation completed");
    }
  }

  /**
   * Refreshes the store by calling specified actions.
   * @param refreshOptions - Options to control the refresh behavior.
   */
  function refreshState(
    refreshOptions: PiniaStoreLifecycleManagerRefreshOptions
  ) {
    const { mode, includeResetOnlyActions = false } = refreshOptions;

    if (pluginOptions?.enableDebugLogs) {
      debugLog(store.$id, "Initiating refresh action", {
        mode,
        includeResetOnlyActions,
        refreshOptions: options.lifecycleOptions?.refresh,
      });
    }

    if (!options.lifecycleOptions?.refresh) {
      if (pluginOptions?.enableDebugLogs) {
        debugLog(
          store.$id,
          "Refresh action skipped: No refresh options defined"
        );
      }
      return;
    }

    const refreshResult: RefreshOptions<Store> | undefined =
      typeof options.lifecycleOptions.refresh === "function"
        ? options.lifecycleOptions.refresh.length > 0
          ? options.lifecycleOptions.refresh(store)
          : (
              options.lifecycleOptions
                .refresh as () => RefreshOptions<Store> | void
            )()
        : options.lifecycleOptions.refresh;

    if (refreshResult && typeof refreshResult === "object") {
      const filteredResult = Object.fromEntries(
        Object.entries(refreshResult).filter(([key, value]) => {
          const actionResetOnly =
            (value as { resetOnly?: boolean } | undefined)?.resetOnly ?? false;
          const shouldInclude =
            mode === "full"
              ? !includeResetOnlyActions ||
                (includeResetOnlyActions && actionResetOnly)
              : !actionResetOnly;

          if (pluginOptions?.enableDebugLogs) {
            debugLog(store.$id, `Filtering refresh action: ${key}`, {
              shouldInclude,
              mode,
              includeResetOnlyActions,
              actionResetOnly,
            });
          }
          return shouldInclude;
        })
      );

      Object.entries(filteredResult).forEach(([key, value]) => {
        const actionKey = key as keyof StoreActions<Store>;
        const action = store[actionKey];

        if (action) {
          const params =
            (value as { params: Parameters<typeof action> } | undefined)
              ?.params ?? [];
          if (pluginOptions?.enableDebugLogs) {
            debugLog(store.$id, `Executing refresh action: ${key}`, { params });
          }
          action(...params);
        } else {
          if (pluginOptions?.enableDebugLogs) {
            debugLog(store.$id, `Skipped non-existent refresh action: ${key}`);
          }
        }
      });
    } else {
      if (pluginOptions?.enableDebugLogs) {
        debugLog(store.$id, "Refresh action skipped: Invalid refresh result");
      }
    }

    if (pluginOptions?.enableDebugLogs) {
      debugLog(store.$id, "Refresh action completed");
    }
  }
};
