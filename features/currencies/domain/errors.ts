/**
 * Currency Domain Errors
 *
 * Error classes for the currencies feature.
 * All errors extend DomainError for type-safe handling.
 *
 * @module features/currencies/domain/errors
 */

import { DomainError } from '@/lib/errors/domain-error';

/**
 * Repository error for database/network failures when fetching currencies.
 */
export class CurrencyRepositoryError extends DomainError {
  readonly code = 'CURRENCY_REPOSITORY_ERROR';

  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
  }
}

/**
 * Validation error when currency data fails schema validation.
 */
export class CurrencyValidationError extends DomainError {
  readonly code = 'CURRENCY_VALIDATION_ERROR';

  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
  }
}

// Type guards

export function isCurrencyRepositoryError(
  error: unknown
): error is CurrencyRepositoryError {
  return error instanceof CurrencyRepositoryError;
}

export function isCurrencyValidationError(
  error: unknown
): error is CurrencyValidationError {
  return error instanceof CurrencyValidationError;
}
