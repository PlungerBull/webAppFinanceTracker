/**
 * Transaction Domain Errors
 *
 * Domain-specific error types for transaction operations.
 *
 * These errors are thrown by:
 * - Repository layer (data access errors)
 * - Service layer (business logic errors)
 *
 * Benefits:
 * - Type-safe error handling
 * - Clear error context for debugging
 * - Consistent error messages across platforms
 *
 * Swift Mirror:
 * ```swift
 * enum TransactionError: Error {
 *     case notFound(id: String)
 *     case versionConflict(id: String, expectedVersion: Int)
 *     case validationError(message: String)
 *     case authenticationError
 *     case repositoryError(message: String)
 *     case unexpectedError(message: String)
 * }
 * ```
 *
 * @module transaction-errors
 */

/**
 * Base Transaction Error
 *
 * All transaction-specific errors extend this class.
 */
export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

/**
 * Transaction Not Found Error
 *
 * Thrown when a transaction with the given ID does not exist.
 */
export class TransactionNotFoundError extends TransactionError {
  constructor(public readonly transactionId: string) {
    super(`Transaction not found: ${transactionId}`, 'TRANSACTION_NOT_FOUND');
    this.name = 'TransactionNotFoundError';
  }
}

/**
 * Transaction Version Conflict Error
 *
 * Thrown when optimistic concurrency check fails.
 * This happens when another user modified the transaction
 * between when you fetched it and when you tried to update it.
 *
 * Recovery Strategy:
 * 1. Fetch latest version
 * 2. Retry update with new version number
 * 3. If still conflicts, show conflict resolution UI
 */
export class TransactionVersionConflictError extends TransactionError {
  constructor(
    public readonly transactionId: string,
    public readonly expectedVersion: number
  ) {
    super(
      `Transaction ${transactionId} has been modified by another user. Expected version ${expectedVersion}.`,
      'VERSION_CONFLICT'
    );
    this.name = 'TransactionVersionConflictError';
  }
}

/**
 * Transaction Validation Error
 *
 * Thrown when transaction data fails validation.
 *
 * Examples:
 * - Amount exceeds max/min limits
 * - Description too long
 * - Invalid date format
 * - Missing required fields
 */
export class TransactionValidationError extends TransactionError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'TransactionValidationError';
    this.field = field;
  }
}

/**
 * Transaction Authentication Error
 *
 * Thrown when user is not authenticated or doesn't have permission.
 */
export class TransactionAuthenticationError extends TransactionError {
  constructor(message: string = 'User not authenticated') {
    super(message, 'AUTHENTICATION_ERROR');
    this.name = 'TransactionAuthenticationError';
  }
}

/**
 * Transaction Repository Error
 *
 * Thrown when database operation fails (Supabase error).
 *
 * Examples:
 * - Network timeout
 * - Database constraint violation
 * - RPC function error
 */
export class TransactionRepositoryError extends TransactionError {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message, 'REPOSITORY_ERROR');
    this.name = 'TransactionRepositoryError';
  }
}

/**
 * Unexpected Transaction Error
 *
 * Thrown when an unexpected error occurs (catch-all).
 */
export class UnexpectedTransactionError extends TransactionError {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message, 'UNEXPECTED_ERROR');
    this.name = 'UnexpectedTransactionError';
  }
}

/**
 * Transaction Deleted Error
 *
 * Thrown when attempting to operate on a soft-deleted transaction.
 */
export class TransactionDeletedError extends TransactionError {
  constructor(public readonly transactionId: string) {
    super(`Transaction ${transactionId} has been deleted`, 'TRANSACTION_DELETED');
    this.name = 'TransactionDeletedError';
  }
}

/**
 * RPC Mismatch Error
 *
 * Thrown when client calls an RPC function with a signature that
 * doesn't match any database overload. This is a programmer error
 * (non-operational) that should alert Sentry.
 *
 * Common causes:
 * - Migration added new parameters but client wasn't updated
 * - Client sends combination of parameters no overload accepts
 * - TypeScript types out of sync with database schema
 */
export class RpcMismatchError extends TransactionError {
  /**
   * Non-operational errors trigger Sentry alerts.
   * This is a programmer bug, not a user-recoverable error.
   */
  readonly isOperational = false;

  constructor(
    public readonly functionName: string,
    public readonly originalError?: unknown
  ) {
    super(
      `RPC signature mismatch for ${functionName}. Client parameters don't match any database overload.`,
      'RPC_MISMATCH'
    );
    this.name = 'RpcMismatchError';
  }
}

/**
 * Type guard to check if error is a TransactionError
 */
export function isTransactionError(error: unknown): error is TransactionError {
  return error instanceof TransactionError;
}

/**
 * Type guard to check if error is a version conflict
 */
export function isVersionConflictError(
  error: unknown
): error is TransactionVersionConflictError {
  return error instanceof TransactionVersionConflictError;
}

/**
 * Type guard to check if error is a validation error
 */
export function isValidationError(error: unknown): error is TransactionValidationError {
  return error instanceof TransactionValidationError;
}
