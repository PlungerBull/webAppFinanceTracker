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
};

type ErrorWithCode = Error & { code?: string };

/**
 * Report a domain error to Sentry with appropriate severity and tags.
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
  const code = (error as ErrorWithCode).code;
  const level = code ? (SEVERITY_MAP[code] ?? 'error') : 'error';

  Sentry.captureException(error, {
    level,
    tags: {
      domain,
      ...(code ? { 'error.code': code } : {}),
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
  error: Error,
  domain: string,
  operation: string
): void {
  reportError(error, domain, { operation });
}
