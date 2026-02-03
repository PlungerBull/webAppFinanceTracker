/**
 * Reconciliations Service Interface
 *
 * Contract for reconciliation business logic operations.
 * Handles authentication, orchestration, and delegates data access to repository.
 *
 * @module features/reconciliations/services
 */

import type { DataResult } from '@/lib/data-patterns';
import type { Reconciliation, ReconciliationSummary } from '@/domain/reconciliations';
import type { LinkUnlinkResult } from '../repository';
import {
  ReconciliationRepositoryError,
  ReconciliationNotFoundError,
  ReconciliationVersionConflictError,
  ReconciliationCompletedError,
  ReconciliationLinkError,
} from '../domain/errors';

/** Create reconciliation input (without userId - service handles auth) */
export interface CreateReconciliationServiceInput {
  accountId: string;
  name: string;
  beginningBalance: number;
  endingBalance: number;
  dateStart?: string | null;
  dateEnd?: string | null;
}

/** Update reconciliation input */
export interface UpdateReconciliationServiceInput {
  name?: string;
  beginningBalance?: number;
  endingBalance?: number;
  dateStart?: string | null;
  dateEnd?: string | null;
  status?: 'draft' | 'completed';
}

export interface IReconciliationsService {
  /**
   * Get all reconciliations for current user (optionally filtered by account)
   */
  getAll(accountId?: string): Promise<DataResult<Reconciliation[], ReconciliationRepositoryError>>;

  /**
   * Get single reconciliation by ID
   */
  getById(
    id: string
  ): Promise<DataResult<Reconciliation, ReconciliationRepositoryError | ReconciliationNotFoundError>>;

  /**
   * Create new reconciliation for current user
   */
  create(
    data: CreateReconciliationServiceInput
  ): Promise<DataResult<Reconciliation, ReconciliationRepositoryError>>;

  /**
   * Update reconciliation
   */
  update(
    id: string,
    updates: UpdateReconciliationServiceInput
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
