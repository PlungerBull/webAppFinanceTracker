/**
 * Reconciliations Service
 *
 * Service layer for reconciliation operations.
 * Handles authentication and delegates data access to repository.
 * Returns DataResult for S-Tier error handling across Native Bridge.
 *
 * @module features/reconciliations/services
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { DataResult } from '@/lib/data-patterns';
import type { Reconciliation, ReconciliationSummary } from '@/domain/reconciliations';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { ReconciliationRepositoryError, ReconciliationLinkError } from '../domain/errors';
import type { IReconciliationsRepository, LinkUnlinkResult } from '../repository';
import { SupabaseReconciliationsRepository } from '../repository';
import type {
  IReconciliationsService,
  CreateReconciliationServiceInput,
  UpdateReconciliationServiceInput,
} from './reconciliations-service.interface';

export class ReconciliationsService implements IReconciliationsService {
  constructor(
    private readonly repository: IReconciliationsRepository,
    private readonly authProvider: IAuthProvider
  ) {}

  private async getCurrentUserId(): Promise<DataResult<string, ReconciliationRepositoryError>> {
    try {
      const userId = await this.authProvider.getCurrentUserId();
      return { success: true, data: userId };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new ReconciliationRepositoryError('User not authenticated', err),
      };
    }
  }

  async getAll(
    accountId?: string
  ): Promise<DataResult<Reconciliation[], ReconciliationRepositoryError>> {
    return this.repository.getAll(accountId);
  }

  async getById(id: string) {
    return this.repository.getById(id);
  }

  async create(data: CreateReconciliationServiceInput) {
    const userIdResult = await this.getCurrentUserId();
    if (!userIdResult.success) {
      return userIdResult;
    }

    return this.repository.create({
      userId: userIdResult.data,
      accountId: data.accountId,
      name: data.name,
      beginningBalance: data.beginningBalance,
      endingBalance: data.endingBalance,
      dateStart: data.dateStart,
      dateEnd: data.dateEnd,
    });
  }

  async update(id: string, updates: UpdateReconciliationServiceInput) {
    return this.repository.update(id, updates);
  }

  async delete(id: string, version: number) {
    return this.repository.delete(id, version);
  }

  async linkTransactions(
    reconciliationId: string,
    transactionIds: string[]
  ): Promise<DataResult<LinkUnlinkResult, ReconciliationRepositoryError | ReconciliationLinkError>> {
    return this.repository.linkTransactions(reconciliationId, transactionIds);
  }

  async unlinkTransactions(
    transactionIds: string[]
  ): Promise<DataResult<LinkUnlinkResult, ReconciliationRepositoryError | ReconciliationLinkError>> {
    return this.repository.unlinkTransactions(transactionIds);
  }

  async getSummary(
    reconciliationId: string
  ): Promise<DataResult<ReconciliationSummary, ReconciliationRepositoryError>> {
    return this.repository.getSummary(reconciliationId);
  }
}

/**
 * Factory function to create ReconciliationsService with proper DI.
 */
export function createReconciliationsService(supabase: SupabaseClient): ReconciliationsService {
  const authProvider = createSupabaseAuthProvider(supabase);
  const repository = new SupabaseReconciliationsRepository(supabase);
  return new ReconciliationsService(repository, authProvider);
}
