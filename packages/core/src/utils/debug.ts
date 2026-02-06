/**
 * Debug utilities for Deskhand
 *
 * Simple debug logging that can be enabled/disabled.
 * In development, logs are enabled by default.
 */

const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';

/**
 * Debug logger
 * @param namespace - Debug namespace (e.g., 'agent', 'session')
 */
export function debug(namespace: string) {
  return (...args: unknown[]) => {
    if (DEBUG_ENABLED) {
      console.log(`[${namespace}]`, ...args);
    }
  };
}
