/**
 * Financial Overview Hook
 *
 * S-Tier Pattern: Unwraps DataResult and throws actual DomainError
 * for React Query error handling with preserved instanceof checks.
 *
 * @module features/dashboard/hooks
 */

import { useQuery } from '@tanstack/react-query';
import { DATABASE, QUERY_KEYS } from '@/lib/constants';
import {
  financialOverviewApi,
  type FinancialOverviewData,
} from '../api/financial-overview';
import type { CategoryMonthlyData } from '@/lib/data/data-transformers';

// Re-export for consumers that import from this hook
export type { CategoryMonthlyData, FinancialOverviewData };

/**
 * Custom hook to fetch financial overview data with categories grouped by type
 * and organized by parent-child hierarchy.
 *
 * @param monthsBack - Number of months to fetch data for (default: DATABASE.MONTHS_BACK.DEFAULT)
 * @returns Query result with income and expense categories with monthly data
 */
export function useFinancialOverview(monthsBack = DATABASE.MONTHS_BACK.DEFAULT) {
  return useQuery<FinancialOverviewData>({
    queryKey: QUERY_KEYS.TRANSACTIONS.MONTHLY_SPENDING(monthsBack),
    queryFn: async () => {
      const result = await financialOverviewApi.getOverview(monthsBack);
      if (!result.success) {
        // S-Tier: Throw actual DomainError, not generic Error
        throw result.error;
      }
      return result.data;
    },
  });
}
