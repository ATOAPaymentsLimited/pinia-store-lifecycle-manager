/**
 * Logs a debug message with optional data.
 * @param storeId - The ID of the store.
 * @param message - The debug message.
 * @param data - Optional data to log.
 */
export function debugLog(storeId: string, message: string, data?: unknown) {
  console.log(`🔄 [${storeId}] ${message}`, data ? data : "");
}

/**
 * Warns about attempting to modify a non-writable property.
 * @param storeId - The ID of the store.
 * @param propertyName - The name of the non-writable property.
 */
export function devWarnNonWritable(storeId: string, propertyName: string) {
  console.warn(
    `🔄 🚫 [${storeId}] Skipped non-writable property '${propertyName}'. Avoid including non-writable computed properties in clean or reConfigure options.`
  );
}

/**
 * Logs an error message with details.
 * @param storeId - The ID of the store.
 * @param message - The error message.
 * @param error - The error object or details.
 */
export function devError(
  storeId: string,
  message: string,
  error: unknown
): void {
  console.error(
    `🔄 [PiniaStoreLifecycleManager] (${storeId}) ${message}`,
    error
  );
}
