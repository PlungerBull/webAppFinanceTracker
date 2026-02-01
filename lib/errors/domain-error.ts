/**
 * Domain Error Base Class
 *
 * Abstract base class for all domain errors across features.
 * Enables type-safe error handling with `instanceof` checks.
 *
 * CTO MANDATES:
 * - ALL domain errors MUST extend this class
 * - Use instanceof for error handling (NOT string matching)
 * - Error codes follow feature_ERROR_TYPE convention
 *
 * Swift Mirror:
 * ```swift
 * protocol DomainError: LocalizedError {
 *     var code: String { get }
 * }
 * ```
 *
 * @module domain-error
 */

/**
 * Domain Error
 *
 * Base class for all domain-specific errors.
 * Provides type-safe error handling via instanceof.
 *
 * Usage:
 * ```typescript
 * // In repository:
 * return { success: false, data: null, error: new AccountLockedError(id, 'reconciled') };
 *
 * // In hook:
 * if (err instanceof AccountLockedError) {
 *   toast.error(messages[err.reason]);
 * }
 * ```
 *
 * Swift Mirror:
 * ```swift
 * protocol DomainError: LocalizedError {
 *     var code: String { get }
 *     var isOperational: Bool { get }
 * }
 * ```
 */
export abstract class DomainError extends Error {
  /**
   * Unique error code for cross-platform handling.
   * Convention: FEATURE_ERROR_TYPE (e.g., ACCOUNT_LOCKED, TRANSFER_INVALID)
   */
  abstract readonly code: string;

  /**
   * Operational errors are expected failures (network, validation, conflicts).
   * Non-operational errors are programmer bugs (syntax, type errors).
   * Sentry only alerts on isOperational: false.
   */
  readonly isOperational: boolean = true;

  /**
   * Original error for debugging and Sentry stack traces.
   * Preserved for root cause analysis without leaking to UI.
   */
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.originalError = originalError;
    // Ensure proper prototype chain for instanceof checks
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Type guard for DomainError
 *
 * Use when you need to check if an error is any DomainError.
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
