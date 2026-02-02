/**
 * Dashboard Domain Errors
 *
 * Error classes for the dashboard feature.
 * All errors extend DomainError for type-safe handling.
 *
 * @module features/dashboard/domain/errors
 */

import { DomainError } from '@/lib/errors/domain-error';

/**
 * Repository error for database/network failures in dashboard operations.
 */
export class DashboardRepositoryError extends DomainError {
  readonly code = 'DASHBOARD_REPOSITORY_ERROR';

  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
  }
}

/**
 * Validation error when dashboard data fails schema validation.
 */
export class DashboardValidationError extends DomainError {
  readonly code = 'DASHBOARD_VALIDATION_ERROR';

  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
  }
}

export function isDashboardRepositoryError(
  error: unknown
): error is DashboardRepositoryError {
  return error instanceof DashboardRepositoryError;
}

export function isDashboardValidationError(
  error: unknown
): error is DashboardValidationError {
  return error instanceof DashboardValidationError;
}
