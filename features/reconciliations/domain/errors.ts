/**
 * Reconciliation Domain Errors
 *
 * Error classes for the reconciliations feature.
 * All errors extend DomainError for type-safe handling.
 *
 * @module features/reconciliations/domain/errors
 */

import { DomainError } from '@/lib/errors/domain-error';

/**
 * Repository error for database/network failures in reconciliation operations.
 */
export class ReconciliationRepositoryError extends DomainError {
  readonly code = 'RECONCILIATION_REPOSITORY_ERROR';

  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
  }
}

/**
 * Reconciliation not found error.
 * Thrown when reconciliation ID doesn't exist.
 */
export class ReconciliationNotFoundError extends DomainError {
  readonly code = 'RECONCILIATION_NOT_FOUND';

  constructor(
    public readonly reconciliationId: string,
    originalError?: unknown
  ) {
    super(`Reconciliation not found: ${reconciliationId}`, originalError);
  }
}

/**
 * Validation error for invalid reconciliation data.
 */
export class ReconciliationValidationError extends DomainError {
  readonly code = 'RECONCILIATION_VALIDATION_ERROR';

  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
  }
}

/**
 * Version conflict error for offline-first sync.
 * Thrown when another client updated the reconciliation concurrently.
 */
export class ReconciliationVersionConflictError extends DomainError {
  readonly code = 'RECONCILIATION_VERSION_CONFLICT';

  constructor(message: string = 'Reconciliation was modified by another client', originalError?: unknown) {
    super(message, originalError);
  }
}

/**
 * Reconciliation completed error.
 * Thrown when attempting to modify a completed reconciliation.
 */
export class ReconciliationCompletedError extends DomainError {
  readonly code = 'RECONCILIATION_COMPLETED';

  constructor(
    public readonly reconciliationId: string,
    originalError?: unknown
  ) {
    super(`Cannot modify completed reconciliation: ${reconciliationId}`, originalError);
  }
}

/**
 * Link failed error.
 * Thrown when linking transactions to a reconciliation fails.
 */
export class ReconciliationLinkError extends DomainError {
  readonly code = 'RECONCILIATION_LINK_FAILED';

  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
  }
}

// Type guards

export function isReconciliationRepositoryError(
  error: unknown
): error is ReconciliationRepositoryError {
  return error instanceof ReconciliationRepositoryError;
}

export function isReconciliationNotFoundError(
  error: unknown
): error is ReconciliationNotFoundError {
  return error instanceof ReconciliationNotFoundError;
}

export function isReconciliationValidationError(
  error: unknown
): error is ReconciliationValidationError {
  return error instanceof ReconciliationValidationError;
}

export function isReconciliationVersionConflictError(
  error: unknown
): error is ReconciliationVersionConflictError {
  return error instanceof ReconciliationVersionConflictError;
}

export function isReconciliationCompletedError(
  error: unknown
): error is ReconciliationCompletedError {
  return error instanceof ReconciliationCompletedError;
}

export function isReconciliationLinkError(
  error: unknown
): error is ReconciliationLinkError {
  return error instanceof ReconciliationLinkError;
}
