/**
 * Account Domain Errors
 *
 * Error classes for account operations.
 * Each error has a unique code for cross-platform error handling.
 *
 * Swift Mirror:
 * ```swift
 * enum AccountError: Error, Codable {
 *     case notFound(accountId: String)
 *     case versionConflict(accountId: String, expectedVersion: Int)
 *     case validationError(message: String, field: String?)
 *     case repositoryError(message: String)
 *     case duplicateName(name: String, currency: String)
 * }
 * ```
 *
 * @module account-errors
 */

/**
 * Base Account Error
 *
 * All account errors extend this class.
 */
export class AccountError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

/**
 * Account Not Found Error
 *
 * Thrown when an account cannot be found by ID.
 */
export class AccountNotFoundError extends AccountError {
  constructor(public readonly accountId: string) {
    super(`Account not found: ${accountId}`, 'ACCOUNT_NOT_FOUND');
    this.name = 'AccountNotFoundError';
  }
}

/**
 * Account Version Conflict Error
 *
 * Thrown when an update fails due to optimistic concurrency conflict.
 */
export class AccountVersionConflictError extends AccountError {
  constructor(
    public readonly accountId: string,
    public readonly expectedVersion: number
  ) {
    super(
      `Account ${accountId} has been modified by another user. Expected version ${expectedVersion}.`,
      'VERSION_CONFLICT'
    );
    this.name = 'AccountVersionConflictError';
  }
}

/**
 * Account Validation Error
 *
 * Thrown when account data fails validation.
 */
export class AccountValidationError extends AccountError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'AccountValidationError';
  }
}

/**
 * Account Repository Error
 *
 * Thrown when a database operation fails.
 */
export class AccountRepositoryError extends AccountError {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message, 'REPOSITORY_ERROR');
    this.name = 'AccountRepositoryError';
  }
}

/**
 * Account Duplicate Name Error
 *
 * Thrown when attempting to create an account with a duplicate name+currency.
 */
export class AccountDuplicateNameError extends AccountError {
  constructor(
    public readonly name: string,
    public readonly currencyCode: string
  ) {
    super(
      `Account "${name}" already exists for currency ${currencyCode}`,
      'DUPLICATE_NAME'
    );
    this.name = 'AccountDuplicateNameError';
  }
}

/**
 * Type guard for AccountNotFoundError
 */
export function isAccountNotFoundError(
  error: unknown
): error is AccountNotFoundError {
  return error instanceof AccountNotFoundError;
}

/**
 * Type guard for AccountVersionConflictError
 */
export function isVersionConflictError(
  error: unknown
): error is AccountVersionConflictError {
  return error instanceof AccountVersionConflictError;
}

/**
 * Type guard for AccountValidationError
 */
export function isValidationError(
  error: unknown
): error is AccountValidationError {
  return error instanceof AccountValidationError;
}

/**
 * Type guard for AccountDuplicateNameError
 */
export function isDuplicateNameError(
  error: unknown
): error is AccountDuplicateNameError {
  return error instanceof AccountDuplicateNameError;
}
