/**
 * Settings Domain Errors
 *
 * Error classes for the settings feature.
 * All errors extend DomainError for type-safe handling.
 *
 * @module features/settings/domain/errors
 */

import { DomainError } from '@/lib/errors/domain-error';

/**
 * Repository error for database/network failures in settings operations.
 */
export class SettingsRepositoryError extends DomainError {
  readonly code = 'SETTINGS_REPOSITORY_ERROR';

  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
  }
}

/**
 * Settings not found error.
 * Thrown when user settings do not exist (e.g., new user without settings row).
 */
export class SettingsNotFoundError extends DomainError {
  readonly code = 'SETTINGS_NOT_FOUND';

  constructor(message: string = 'User settings not found', originalError?: unknown) {
    super(message, originalError);
  }
}

/**
 * Validation error for invalid settings data.
 * Thrown when settings input fails validation (e.g., invalid currency code).
 */
export class SettingsValidationError extends DomainError {
  readonly code = 'SETTINGS_VALIDATION_ERROR';

  constructor(message: string, originalError?: unknown) {
    super(message, originalError);
  }
}

/**
 * Authentication error for settings operations.
 * Thrown when user is not authenticated or session expired.
 */
export class SettingsAuthenticationError extends DomainError {
  readonly code = 'SETTINGS_AUTHENTICATION_ERROR';

  constructor(message: string = 'User not authenticated', originalError?: unknown) {
    super(message, originalError);
  }
}

// Type guards

export function isSettingsRepositoryError(
  error: unknown
): error is SettingsRepositoryError {
  return error instanceof SettingsRepositoryError;
}

export function isSettingsNotFoundError(
  error: unknown
): error is SettingsNotFoundError {
  return error instanceof SettingsNotFoundError;
}

export function isSettingsValidationError(
  error: unknown
): error is SettingsValidationError {
  return error instanceof SettingsValidationError;
}

export function isSettingsAuthenticationError(
  error: unknown
): error is SettingsAuthenticationError {
  return error instanceof SettingsAuthenticationError;
}
