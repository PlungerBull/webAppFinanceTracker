/**
 * Reconciliations Repository Interface
 *
 * Contract for reconciliation data access operations.
 * Implementations handle database queries, validation, and error mapping.
 *
 * @module features/reconciliations/repository
 */

import type { DataResult } from '@/lib/data-patterns';
import type { Reconciliation, ReconciliationSummary } from '@/domain/reconciliations';
import {
  ReconciliationRepositoryError,
  ReconciliationNotFoundError,
  ReconciliationVersionConflictError,
  ReconciliationCompletedError,
  ReconciliationLinkError,
} from '../domain/errors';

/** Result type for link/unlink operations */
export interface LinkUnlinkResult {
  success: boolean;
  successCount: number;
  errorCount: number;
  errors: Array<{ transactionId: string; error: string }>;
}

/** Create reconciliation input */
export interface CreateReconciliationInput {
  userId: string;
  accountId: string;
  name: string;
  beginningBalance: number;
  endingBalance: number;
  dateStart?: string | null;
  dateEnd?: string | null;
}

/** Update reconciliation input */
export interface UpdateReconciliationInput {
  name?: string;
  beginningBalance?: number;
  endingBalance?: number;
  dateStart?: string | null;
  dateEnd?: string | null;
  status?: 'draft' | 'completed';
}

export interface IReconciliationsRepository {
  /**
   * Get all reconciliations (optionally filtered by account)
   * Filters out soft-deleted reconciliations (tombstone pattern)
   */
  getAll(accountId?: string): Promise<DataResult<Reconciliation[], ReconciliationRepositoryError>>;

  /**
   * Get single reconciliation by ID
   * Returns not found error if soft-deleted (tombstone pattern)
   */
  getById(
    id: string
  ): Promise<DataResult<Reconciliation, ReconciliationRepositoryError | ReconciliationNotFoundError>>;

  /**
   * Create new reconciliation
   */
  create(
    data: CreateReconciliationInput
  ): Promise<DataResult<Reconciliation, ReconciliationRepositoryError>>;

  /**
   * Update reconciliation
   */
  update(
    id: string,
    updates: UpdateReconciliationInput
  ): Promise<DataResult<Reconciliation, ReconciliationRepositoryError | ReconciliationNotFoundError>>;

  /**
   * Delete reconciliation (soft delete with version check)
   */
  delete(
    id: string,
    version: number
  ): Promise<
    DataResult<
      void,
      ReconciliationRepositoryError | ReconciliationVersionConflictError | ReconciliationCompletedError
    >
  >;

  /**
   * Link transactions to reconciliation (bulk)
   */
  linkTransactions(
    reconciliationId: string,
    transactionIds: string[]
  ): Promise<DataResult<LinkUnlinkResult, ReconciliationRepositoryError | ReconciliationLinkError>>;

  /**
   * Unlink transactions from reconciliation (bulk)
   */
  unlinkTransactions(
    transactionIds: string[]
  ): Promise<DataResult<LinkUnlinkResult, ReconciliationRepositoryError | ReconciliationLinkError>>;

  /**
   * Get reconciliation summary (real-time math)
   */
  getSummary(
    reconciliationId: string
  ): Promise<DataResult<ReconciliationSummary, ReconciliationRepositoryError>>;
}
