/**
 * Transaction Operations Orchestrator Hook
 *
 * Provides cross-feature access to transaction operations.
 * Used by category orchestrator for S-Tier validation (deletion checks).
 *
 * ARCHITECTURE PATTERN:
 * - Orchestrators import from @/lib/hooks/use-transaction-operations
 * - This hook internally uses the transaction service
 * - Features never import directly from @/features/transactions/hooks
 *
 * CTO MANDATE: Orchestrator Rule
 * - Returns null until service is ready
 * - Consumers must guard with enabled: !!operations
 *
 * Swift Mirror:
 * ```swift
 * class TransactionOperationsAdapter: TransactionOperationsProtocol {
 *     private let transactionService: TransactionServiceProtocol
 *
 *     func getCountByCategory(categoryId: String) async throws -> Int
 * }
 * ```
 *
 * @module lib/hooks/use-transaction-operations
 */

'use client';

import { useMemo } from 'react';
import { useTransactionService } from '@/features/transactions/hooks/use-transaction-service';

/**
 * Transaction operations interface for cross-feature use.
 *
 * S-TIER: Provides only the methods needed for cross-module orchestration.
 */
export interface ITransactionOperations {
  /**
   * Get transaction count for a specific category.
   *
   * S-TIER: Used by category orchestrator for deletion validation.
   *
   * @param categoryId - Category ID
   * @returns Transaction count
   */
  getCountByCategory(categoryId: string): Promise<number>;
}

/**
 * Hook that provides ITransactionOperations interface.
 *
 * Creates an adapter around the TransactionService that exposes only
 * the methods needed for cross-feature orchestration.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns null until local database is ready.
 *
 * @returns ITransactionOperations implementation or null if not ready
 *
 * @example
 * ```typescript
 * function useCategoryOperations() {
 *   const transactionOps = useTransactionOperations();
 *
 *   const canDelete = async (categoryId: string) => {
 *     const count = await transactionOps?.getCountByCategory(categoryId) ?? 0;
 *     return count === 0;
 *   };
 * }
 * ```
 */
export function useTransactionOperations(): ITransactionOperations | null {
  const service = useTransactionService();

  return useMemo(() => {
    // CTO MANDATE: Orchestrator Rule
    // Don't create operations until service is ready
    if (!service) {
      return null;
    }

    return {
      getCountByCategory: (categoryId: string) =>
        service.getCountByCategory(categoryId),
    };
  }, [service]);
}
