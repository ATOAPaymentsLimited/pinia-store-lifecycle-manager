# Pinia Store Lifecycle Manager

A robust Pinia plugin designed to manage store lifecycles seamlessly, including state resets and refreshes. Enhance your Vue applications with streamlined state management tailored for dynamic development needs.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
  - [Basic Setup](#basic-setup)
  - [Advanced Configuration](#advanced-configuration)
- [Features](#features)
- [Use Cases](#use-cases)
- [API Reference](#api-reference)
- [Why Choose Pinia Store Lifecycle Manager](#why-choose-pinia-store-lifecycle-manager)
- [License](#license)

## Installation

You can install the Pinia Store Lifecycle Manager using npm or Yarn:

```bash
npm install pinia-store-lifecycle-manager
# or
yarn add pinia-store-lifecycle-manager
```

## Usage

### Basic Setup

```typescript
//vue
import { createPinia } from "pinia";
import { PiniaStoreLifecycleManager } from "pinia-store-lifecycle-manager";

const pinia = createPinia();
pinia.use((context) => {
  PiniaStoreLifecycleManager(context, (lifecycleEvents) => {
    // Register your lifecycle event handlers here
    // For example:
    // lifecycleEvents.reset();
    // lifecycleEvents.reconfigure();
    // lifecycleEvents.refresh({ mode: 'full' });
  });
});
```

#### Nuxt

```typescript
// \plugin\pinia-store-lifecycle-manager.ts
import type { Pinia } from "pinia";
import { PiniaStoreLifecycleManager } from "pinia-store-lifecycle-manager";

export default defineNuxtPlugin(({ $pinia }) => {
  ($pinia as Pinia).use((pluginContext) => {
    return PiniaStoreLifecycleManager(
      pluginContext,
      (lifecycleEvents) => {
        // Use event listeners of your choice
        const { $listen } = useNuxtApp();

        // Register event listeners
        $listen("user:logOut", () => {
          lifecycleEvents.reset();
        });
        $listen("user:switchProfile", () => {
          // Reset the store and perform a full refresh when switching profile
          lifecycleEvents.reset();
          lifecycleEvents.refresh({
            mode: "full",
            includeResetOnlyActions: true,
          });
        });
        $listen("user:anyEvent", () => {
          // Reconfigure the store and perform a partial refresh
          lifecycleEvents.reconfigure();
          lifecycleEvents.refresh({ mode: "partial" });
        });
      },
      {
        enableDebugLogs: __DEV__,
      }
    );
  });
});

```

### Advanced Configuration

```typescript
import { createPinia } from "pinia";
import { PiniaStoreLifecycleManager } from "pinia-store-lifecycle-manager";

const pinia = createPinia();
pinia.use((context) => {
  PiniaStoreLifecycleManager(
    context,
    (lifecycleEvents) => {
      // Define custom lifecycle event handlers
    },
    {
      enableDebugLogs: true,
      enableSSR: false,
      disableAutoRegister: false,
    }
  );
});
```

## Features

- **State Reset:** Easily reset the store to its initial state.
- **Reconfiguration:** Update multiple store properties simultaneously.
- **Data Refresh:** Refresh store data by invoking specified actions.
- **Debug Logging:** Enable detailed logging for lifecycle events and actions.
- **SSR Support:** Compatible with server-side rendering setups.

## Use Cases

- **User Authentication:** Reset store states upon user logout.
- **Dynamic Configuration:** Reconfigure store settings based on different environments.
- **Real-time Data Management:** Refresh store data in response to real-time events.
- **State Management Optimization:** Streamline complex state transitions.

## API Reference

### Lifecycle Options

```typescript
interface DefineStoreOptionsBase<S extends StateTree, Store> {
  lifecycleOptions?: {
    clean?: CleanOptions<Store> | CleanFunction<Store> | (() => CleanOptions<Store> | void);
    reConfigure?: ReconfigureOptions<Store> | ReconfigureFunction<Store> | (() => ReconfigureOptions<Store> | void);
    refresh?: RefreshOptions<Store> | RefreshFunction<Store> | (() => RefreshOptions<Store> | void);
    disableListener?: boolean;
  };
}
```

#### Clean and Reconfigure

Both `clean` and `reConfigure` can be defined as an object, a function that takes the store as an argument, or a function that takes no arguments:

```typescript
// As an object
clean: {
  user: null,
  token: '',
  isAuthenticated: false
}

// As a function with store argument
clean: (store) => ({
  user: null,
  token: '',
  isAuthenticated: false
})

// As a function without arguments
clean: () => ({
  user: null,
  token: '',
  isAuthenticated: false
})

// Reconfigure examples (similar pattern)
reConfigure: {
  theme: 'dark',
  language: 'en'
}

reConfigure: (store) => ({
  theme: 'dark',
  language: 'en'
})

reConfigure: () => ({
  theme: 'dark',
  language: 'en'
})
```

#### Refresh

The `refresh` option can be defined as an object, a function that takes the store as an argument, or a function that takes no arguments:

```typescript
// As an object
refresh: {
  fetchUserProfile: { params: [], resetOnly: false },
  fetchUserSettings: { params: [], resetOnly: true }
}

// As a function with store argument
refresh: (store) => ({
  fetchUserProfile: { params: [] },
  fetchUserSettings: { params: [], resetOnly: true }
})

// As a function without arguments
refresh: () => ({
  fetchUserProfile: { params: [] },
  fetchUserSettings: { params: [], resetOnly: true }
})
```

### Refresh Options

When calling the `refresh` function, you can specify options:

```typescript
type PiniaStoreLifecycleManagerRefreshOptions = {
  mode: "full" | "partial";
  includeResetOnlyActions?: boolean;
};

 /**
  * Use 'full' mode when you need to refresh all data, including reset-only actions.
  * This is useful for major state changes, like switching user accounts.
  *
  * Use 'partial' mode for routine updates or when switching to a related context
  * that doesn't require a full data refresh.
  */
 lifecycleEvents.refresh({ mode: 'full', includeResetOnlyActions: true });
```

#### Property Exclusions

The `clean`, `reConfigure`, and `refresh` options automatically exclude certain properties to ensure safe state management:

- Pinia's internal properties (starting with `$`)
- Conventionally private properties (starting with `_`)
- Non-writable computed properties
- State properties defined in the store

This ensures that only appropriate properties are modified during lifecycle operations.

#### Clean and Reconfigure

Both `clean` and `reConfigure` can be defined as either an object or a function:

```typescript
// As an object
clean: {
  user: null,
  token: '',
  isAuthenticated: false
}

// As a function
clean: (store) => ({
  previousUserId: store.user?.id,
  user: null,
  token: '',
  isAuthenticated: false
})

// Reconfigure example
reConfigure: () => ({
  theme: 'dark',
  language: 'en',
})
```

#### Refresh

The `refresh` option can be defined as either an object or a function:

```typescript
// As an object
refresh: {
  fetchUserProfile: { params: ['userId'] },
  fetchUserSettings: { params: [], resetOnly: true }
}

// As a function
refresh: (store) => ({
  fetchUserProfile: { params: [store.userId] },
  fetchUserSettings: { params: [], resetOnly: true }
})
```

#### Property Inclusions and Exclusions

The `clean` and `reConfigure` options include:
- Data variables (including list types)
- Writable computed properties

They automatically exclude:
- Pinia's internal properties (starting with `$`)
- Conventionally private properties (starting with `_`)
- Non-writable computed properties
- Function properties

This ensures that only appropriate properties are modified during lifecycle operations while including all relevant data types.

#### Readonly Properties

The `clean` and `reConfigure` operations automatically skip readonly properties to prevent errors:

- If a property is readonly or a non-writable computed property, it will not be modified during reset or reconfigure operations.
- When debug logs are enabled, a warning with a 🚫 emoji will be issued for each skipped non-writable property, reminding developers to avoid including such properties in clean or reConfigure options.

This ensures that only modifiable properties are affected by lifecycle operations, maintaining the integrity of readonly state and computed properties.

> **Open Issue / Upcoming Enhancement:** 
> We are aware that non-writable properties can currently be included in `clean` and `reConfigure` options, which is not ideal. We plan to enhance the type system to prevent this in a future update. For now, we have a runtime safety check that skips these properties and issues a warning when encountered. Please avoid including non-writable properties in your `clean` and `reConfigure` options to ensure smooth operation and prepare for future updates.

## Why Choose Pinia Store Lifecycle Manager

- **Seamless Integration:** Easily integrates with existing Pinia stores.
- **Highly Customizable:** Offers flexible configuration options.
- **Performance Optimized:** Ensures minimal overhead in state management operations.
- **Comprehensive Logging:** Facilitates debugging through optional debug logs.
- **Active Maintenance:** Regular updates and community support.

## License

MIT