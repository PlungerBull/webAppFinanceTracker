/**
 * Inbox Domain Errors
 *
 * Domain-specific error classes for inbox operations.
 * All errors implement SerializableError for Swift compatibility.
 *
 * @module inbox-errors
 */

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
