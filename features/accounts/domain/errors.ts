/**
 * Account Domain Errors
 *
 * Error classes for account operations.
 * Each error has a unique code for cross-platform error handling.
 *
 * CTO MANDATES:
 * - Use instanceof for error handling (NOT string matching)
 * - SQLSTATE codes map to typed errors in repository
 * - Service layer throws errors directly (preserves type)
 *
 * Swift Mirror:
 * ```swift
 * enum AccountError: Error, Codable {
 *     case notFound(accountId: String)
 *     case versionConflict(accountId: String, expectedVersion: Int)
 *     case validationError(message: String, field: String?)
 *     case repositoryError(message: String)
 *     case duplicateName(name: String, currency: String)
 *     case locked(accountId: String, reason: AccountLockReason)
 * }
 * ```
 *
 * @module account-errors
 */

import { DomainError } from '@/lib/errors';

/**
 * Base Account Error
 *
 * All account errors extend this class.
 */
export class AccountError extends DomainError {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

/**
 * Account Lock Reasons
 *
 * Maps PostgreSQL SQLSTATE codes to human-readable reasons:
 * - 23503 (foreign_key_violation) -> 'foreign_key'
 * - P0001 (raise_exception) -> 'reconciled' (Sacred Ledger triggers)
 * - Transaction check -> 'has_transactions'
 */
export type AccountLockReason = 'reconciled' | 'has_transactions' | 'foreign_key';

/**
 * Account Locked Error
 *
 * Thrown when an account cannot be deleted due to constraints.
 * Repository maps SQLSTATE codes to this error for type-safe handling.
 *
 * SQLSTATE Mapping:
 * - 23503 -> foreign_key (FK constraint violation)
 * - P0001 -> reconciled (Sacred Ledger DB trigger)
 *
 * Usage:
 * ```typescript
 * // In hook onError:
 * if (err instanceof AccountLockedError) {
 *   const messages: Record<AccountLockReason, string> = {
 *     reconciled: 'Account has reconciled transactions.',
 *     has_transactions: 'Account has existing transactions.',
 *     foreign_key: 'Account has linked data.',
 *   };
 *   toast.error('Cannot delete', { description: messages[err.reason] });
 * }
 * ```
 */
export class AccountLockedError extends AccountError {
  constructor(
    public readonly accountId: string,
    public readonly reason: AccountLockReason
  ) {
    const reasonMessages: Record<AccountLockReason, string> = {
      reconciled: 'has reconciled transactions',
      has_transactions: 'has existing transactions',
      foreign_key: 'has linked data that must be removed first',
    };
    super(
      `Account ${accountId} cannot be deleted: ${reasonMessages[reason]}`,
      'ACCOUNT_LOCKED'
    );
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
  }
}

/**
 * Account Duplicate Name Error
 *
 * Thrown when attempting to create an account with a duplicate name+currency.
 */
export class AccountDuplicateNameError extends AccountError {
  constructor(
    public readonly accountName: string,
    public readonly currencyCode: string
  ) {
    super(
      `Account "${accountName}" already exists for currency ${currencyCode}`,
      'DUPLICATE_NAME'
    );
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

/**
 * Type guard for AccountLockedError
 */
export function isAccountLockedError(
  error: unknown
): error is AccountLockedError {
  return error instanceof AccountLockedError;
}
