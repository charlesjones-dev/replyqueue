/**
 * Logger utility for ReplyQueue
 *
 * In production builds, debug logs are disabled.
 * Warnings and errors are always logged for debugging user issues.
 *
 * Usage:
 *   import { createLogger } from '@shared/logger'
 *   const logger = createLogger('ComponentName')
 *   logger.debug('verbose message')  // Only in development
 *   logger.log('info message')       // Always logged
 *   logger.warn('warning')           // Always logged
 *   logger.error('error')            // Always logged
 */

const IS_DEV = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production';

export interface Logger {
  debug: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Create a logger instance with a prefix
 * @param component - Component name for the log prefix
 */
export function createLogger(component: string): Logger {
  const prefix = `[ReplyQueue:${component}]`;

  return {
    // Debug logs are stripped in production
    debug: IS_DEV ? (...args: unknown[]) => console.debug(prefix, ...args) : () => {},

    // Info logs are kept for debugging user issues
    log: (...args: unknown[]) => console.log(prefix, ...args),

    // Warnings are always logged
    warn: (...args: unknown[]) => console.warn(prefix, ...args),

    // Errors are always logged
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}

/**
 * Global logger for shared utilities
 */
export const logger = createLogger('Shared');
