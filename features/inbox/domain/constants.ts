/**
 * Inbox Domain Constants
 *
 * Error code constants for type-safe error matching.
 * Eliminates magic strings in hooks and service layers.
 *
 * CTO Mandate: Compiler-enforced error codes (S-Tier Hardening)
 *
 * Integration:
 * - Web: Hooks and services consume these constants
 * - iOS: Swift code reads from documentation or JSON export
 *
 * Swift Mirror:
 * ```swift
 * enum InboxErrorCode {
 *     static let notFound = "NOT_FOUND"
 *     static let validationError = "VALIDATION_ERROR"
 *     static let repositoryError = "REPOSITORY_ERROR"
 *     static let promotionFailed = "PROMOTION_FAILED"
 *     static let alreadyProcessed = "ALREADY_PROCESSED"
 *     static let versionConflict = "VERSION_CONFLICT"
 * }
 * ```
 *
 * @module inbox-constants
 */

import type { InboxError } from './types';

/**
 * Inbox Error Codes
 *
 * Type-safe constants that align with InboxError['code'] union.
 * The `satisfies` constraint ensures every value is a valid InboxError code —
 * if the union in types.ts changes, this file fails to compile until updated.
 *
 * Usage:
 * ```typescript
 * if (result.error?.code === INBOX_ERROR_CODES.VERSION_CONFLICT) { ... }
 * ```
 */
export const INBOX_ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REPOSITORY_ERROR: 'REPOSITORY_ERROR',
  PROMOTION_FAILED: 'PROMOTION_FAILED',
  ALREADY_PROCESSED: 'ALREADY_PROCESSED',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
} as const satisfies Record<string, InboxError['code']>;

/**
 * Max OCC retry attempts before giving up.
 * Aligns with sync engine's DEFAULT_SYNC_CONFIG.maxRetries: 3.
 */
export const PROMOTE_MAX_RETRIES = 3;

/**
 * Jitter range (ms) to break collision locks between competing clients.
 * Random delay in [min, max) prevents two devices from retrying at the same instant.
 */
export const PROMOTE_RETRY_JITTER = { min: 50, max: 150 } as const;
