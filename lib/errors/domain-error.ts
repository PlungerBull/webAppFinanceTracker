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
 */
export abstract class DomainError extends Error {
  /**
   * Unique error code for cross-platform handling.
   * Convention: FEATURE_ERROR_TYPE (e.g., ACCOUNT_LOCKED, TRANSFER_INVALID)
   */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
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
