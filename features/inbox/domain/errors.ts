/**
 * Inbox Domain Errors
 *
 * Domain-specific error classes for inbox operations.
 * All errors implement SerializableError for Swift compatibility.
 *
 * @module inbox-errors
 */

import { INBOX_ERROR_CODES } from './constants';
import type { InboxError } from './types';

/**
 * Base inbox error class
 */
export class InboxDomainError extends Error implements InboxError {
  readonly code: InboxError['code'];

  constructor(code: InboxError['code'], message: string) {
    super(message);
    this.name = 'InboxDomainError';
    this.code = code;
  }
}

/**
 * Inbox item not found error
 */
export class InboxNotFoundError extends InboxDomainError {
  constructor(id: string) {
    super('NOT_FOUND', `Inbox item not found: ${id}`);
    this.name = 'InboxNotFoundError';
  }
}

/**
 * Inbox validation error
 */
export class InboxValidationError extends InboxDomainError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
    this.name = 'InboxValidationError';
  }
}

/**
 * Inbox repository error (database/network issues)
 */
export class InboxRepositoryError extends InboxDomainError {
  constructor(message: string) {
    super('REPOSITORY_ERROR', message);
    this.name = 'InboxRepositoryError';
  }
}

/**
 * Inbox promotion failed error
 */
export class InboxPromotionError extends InboxDomainError {
  constructor(message: string) {
    super('PROMOTION_FAILED', message);
    this.name = 'InboxPromotionError';
  }
}

/**
 * Inbox item already processed error
 */
export class InboxAlreadyProcessedError extends InboxDomainError {
  constructor(id: string) {
    super('ALREADY_PROCESSED', `Inbox item already processed: ${id}`);
    this.name = 'InboxAlreadyProcessedError';
  }
}

/**
 * Version conflict error (Optimistic Concurrency Control)
 */
export class VersionConflictError extends InboxDomainError {
  constructor(id: string, expected: number, actual: number) {
    super(
      'VERSION_CONFLICT',
      `Version conflict for item ${id}: expected ${expected}, found ${actual}`
    );
    this.name = 'VersionConflictError';
  }
}

// ============================================================================
// TYPE GUARDS — instanceof (pre-serialization)
// ============================================================================

export function isInboxNotFoundError(error: unknown): error is InboxNotFoundError {
  return error instanceof InboxNotFoundError;
}

export function isInboxValidationError(error: unknown): error is InboxValidationError {
  return error instanceof InboxValidationError;
}

export function isInboxRepositoryError(error: unknown): error is InboxRepositoryError {
  return error instanceof InboxRepositoryError;
}

export function isInboxPromotionError(error: unknown): error is InboxPromotionError {
  return error instanceof InboxPromotionError;
}

export function isInboxAlreadyProcessedError(error: unknown): error is InboxAlreadyProcessedError {
  return error instanceof InboxAlreadyProcessedError;
}

export function isVersionConflictError(error: unknown): error is VersionConflictError {
  return error instanceof VersionConflictError;
}

// ============================================================================
// TYPE GUARDS — code-based (post-serialization / DataResult)
// ============================================================================

/**
 * Check if a serialized InboxError has a specific error code.
 * Use this in hooks/UI where errors are serialized InboxError interfaces
 * (not class instances — instanceof won't work across the serialization boundary).
 */
export function hasInboxErrorCode(
  error: InboxError | null | undefined,
  code: InboxError['code']
): boolean {
  return error?.code === code;
}

/**
 * Convenience: check if a serialized InboxError is a version conflict.
 */
export function isVersionConflictCode(error: InboxError | null | undefined): boolean {
  return hasInboxErrorCode(error, INBOX_ERROR_CODES.VERSION_CONFLICT);
}
