/**
 * Sentry Error Reporter
 *
 * Maps DomainError codes to Sentry severity levels and attaches
 * domain tags for filtering in the Sentry dashboard.
 *
 * CTO MANDATE: Telemetric Service Wrapper pattern.
 * Business logic stays clean — this utility handles all Sentry reporting.
 *
 * @module sentry/reporter
 */

import * as Sentry from '@sentry/nextjs';
import type { SeverityLevel } from '@sentry/nextjs';
import type { SerializableError } from '@/lib/data-patterns';

/**
 * Map of error codes to Sentry severity levels.
 *
 * - Warning: Expected errors that users can recover from (conflicts, validation)
 * - Error: Unexpected errors that indicate a bug (not found, repo errors)
 * - Fatal: Database or infrastructure failures
 */
const SEVERITY_MAP: Record<string, SeverityLevel> = {
  // Transaction errors
  VERSION_CONFLICT: 'warning',
  VALIDATION_ERROR: 'warning',
  TRANSACTION_NOT_FOUND: 'error',
  TRANSACTION_DELETED: 'warning',
  AUTHENTICATION_ERROR: 'error',
  REPOSITORY_ERROR: 'fatal',
  UNEXPECTED_ERROR: 'fatal',

  // Inbox errors
  NOT_FOUND: 'error',
  ALREADY_PROCESSED: 'warning',
  PROMOTION_FAILED: 'error',

  // Currency errors
  CURRENCY_REPOSITORY_ERROR: 'fatal',
  CURRENCY_VALIDATION_ERROR: 'warning',

  // Settings errors
  SETTINGS_REPOSITORY_ERROR: 'fatal',
  SETTINGS_NOT_FOUND: 'error',
  SETTINGS_VALIDATION_ERROR: 'warning',
  SETTINGS_AUTHENTICATION_ERROR: 'error',

  // Reconciliation errors
  RECONCILIATION_REPOSITORY_ERROR: 'fatal',
  RECONCILIATION_NOT_FOUND: 'error',
  RECONCILIATION_VALIDATION_ERROR: 'warning',
  RECONCILIATION_VERSION_CONFLICT: 'warning',
  RECONCILIATION_COMPLETED: 'warning',
  RECONCILIATION_LINK_FAILED: 'error',
};

type ErrorWithCode = Error & { code?: string; isOperational?: boolean };

/**
 * Report a domain error to Sentry with appropriate severity and tags.
 *
 * Severity is determined by:
 * 1. isOperational: false → always 'fatal' (programmer error)
 * 2. Error code → mapped via SEVERITY_MAP
 * 3. Default → 'error'
 *
 * @param error - The error to report
 * @param domain - Feature domain (e.g., 'transactions', 'inbox', 'accounts')
 * @param extra - Additional context (will be scrubbed by beforeSend)
 */
export function reportError(
  error: Error,
  domain: string,
  extra?: Record<string, unknown>
): void {
  const typedError = error as ErrorWithCode;
  const code = typedError.code;
  const isOperational = typedError.isOperational ?? true;

  // Non-operational errors (programmer bugs) are always fatal
  const level: SeverityLevel = !isOperational
    ? 'fatal'
    : code
      ? (SEVERITY_MAP[code] ?? 'error')
      : 'error';

  Sentry.captureException(error, {
    level,
    tags: {
      domain,
      ...(code ? { 'error.code': code } : {}),
      'error.operational': String(isOperational),
    },
    extra,
  });
}

/**
 * Report a DataResult failure from a service method.
 *
 * @param error - The error from DataResult.error
 * @param domain - Feature domain
 * @param operation - The operation that failed (e.g., 'create', 'update', 'delete')
 */
export function reportServiceFailure(
  error: Error | SerializableError,
  domain: string,
  operation: string
): void {
  // SerializableError may not be an Error instance; wrap if needed for Sentry
  const reportable = error instanceof Error
    ? error
    : Object.assign(new Error(error.message), { code: error.code });
  reportError(reportable, domain, { operation });
}
