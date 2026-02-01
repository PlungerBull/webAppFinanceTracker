/**
 * Reconciliation Domain Entities
 *
 * Shared reconciliation types for cross-feature use.
 * Part of the "Sacred Domain" - any feature can import from here.
 *
 * The Reconciliation is the "Contract of Truth" between bank statements and ledger.
 *
 * CTO MANDATES:
 * - Integer cents for all monetary amounts (balances stored as cents internally)
 * - Tombstone pattern for distributed sync (deleted_at)
 * - Version-based optimistic concurrency control (global_transaction_version)
 * - Swift-serializable structures
 *
 * @module domain/reconciliations
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Reconciliation Status
 * - draft: Reconciliation in progress, transactions can be linked/unlinked
 * - completed: Reconciliation locked, linked transactions become immutable (semi-permeable lock)
 */
export type ReconciliationStatus = 'draft' | 'completed';

// ============================================================================
// ENTITIES
// ============================================================================

/**
 * Reconciliation Entity
 *
 * Tracks the "Contract of Truth" between bank statements and ledger.
 * All fields use camelCase (frontend convention after transformation).
 *
 * SYNC FIELDS (Phase 2a):
 * - version: Optimistic concurrency control via global_transaction_version
 * - deletedAt: Tombstone pattern for distributed sync
 *
 * Swift Mirror:
 * ```swift
 * struct ReconciliationEntity: Codable {
 *     let id: String
 *     let version: Int
 *     let userId: String
 *     let accountId: String
 *     let name: String
 *     let beginningBalance: Int  // INTEGER CENTS
 *     let endingBalance: Int     // INTEGER CENTS
 *     let dateStart: String?
 *     let dateEnd: String?
 *     let status: ReconciliationStatus
 *     let createdAt: String
 *     let updatedAt: String
 *     let deletedAt: String?
 * }
 * ```
 */
export interface Reconciliation {
  /** Unique identifier */
  readonly id: string;

  /** Sync Version (Optimistic Concurrency Control) */
  readonly version: number;

  /** User ID (for RLS) */
  readonly userId: string;

  /** Account this reconciliation is for */
  readonly accountId: string;

  /** Display name for the reconciliation */
  readonly name: string;

  /** Starting balance per bank statement (INTEGER CENTS) */
  readonly beginningBalance: number;

  /** Ending balance per bank statement (INTEGER CENTS) */
  readonly endingBalance: number;

  /** Optional: Filter transactions >= this date (ISO 8601) */
  readonly dateStart: string | null;

  /** Optional: Filter transactions <= this date (ISO 8601) */
  readonly dateEnd: string | null;

  /** Current status */
  readonly status: ReconciliationStatus;

  /** Created timestamp (ISO 8601) */
  readonly createdAt: string;

  /** Updated timestamp (ISO 8601) */
  readonly updatedAt: string;

  /**
   * Soft Delete Timestamp (Tombstone Pattern)
   * Null = Active, Date = Deleted
   */
  readonly deletedAt: string | null;
}

/**
 * Reconciliation Summary
 *
 * Real-time reconciliation math summary.
 * Formula: Difference = Ending Balance - (Beginning Balance + Linked Sum)
 * isBalanced = true when Difference = 0
 *
 * Note: All amounts are in INTEGER CENTS
 */
export interface ReconciliationSummary {
  /** Starting balance per bank statement (INTEGER CENTS) */
  readonly beginningBalance: number;

  /** Ending balance per bank statement (INTEGER CENTS) */
  readonly endingBalance: number;

  /** Sum of amount_home_cents for all linked transactions */
  readonly linkedSum: number;

  /** Number of transactions linked to this reconciliation */
  readonly linkedCount: number;

  /** The "gap" that needs to be reconciled (INTEGER CENTS) */
  readonly difference: number;

  /** TRUE when difference = 0 (reconciliation complete) */
  readonly isBalanced: boolean;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a reconciliation is in draft status
 */
export function isDraftReconciliation(
  reconciliation: Reconciliation
): reconciliation is Reconciliation & { status: 'draft' } {
  return reconciliation.status === 'draft';
}

/**
 * Type guard to check if a reconciliation is completed/locked
 */
export function isCompletedReconciliation(
  reconciliation: Reconciliation
): reconciliation is Reconciliation & { status: 'completed' } {
  return reconciliation.status === 'completed';
}

/**
 * Type guard to check if a reconciliation is soft-deleted
 */
export function isDeletedReconciliation(reconciliation: Reconciliation): boolean {
  return reconciliation.deletedAt !== null;
}
