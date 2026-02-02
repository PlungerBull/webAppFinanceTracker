/**
 * Financial Overview API
 *
 * Read-only API for fetching dashboard financial data.
 * Returns DataResult for S-Tier error handling across Native Bridge.
 *
 * @module features/dashboard/api
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { CURRENCY, DATABASE } from '@/lib/constants';
import {
  dbMonthlySpendingToDomain,
  type CategoryMonthlyData,
  type MonthlySpendingDbRow,
  type CategoryLookupEntry,
} from '@/lib/data/data-transformers';
import { MonthlySpendingRpcRowSchema } from '@/lib/data/db-row-schemas';
import { reportError } from '@/lib/sentry/reporter';
import type { DataResult } from '@/lib/data-patterns';
import {
  DashboardRepositoryError,
  DashboardValidationError,
} from '../domain/errors';

export interface FinancialOverviewData {
  incomeCategories: CategoryMonthlyData[];
  expenseCategories: CategoryMonthlyData[];
  mainCurrency: string;
}

/**
 * Sorts categories by parent-child hierarchy and name.
 * Parents come first, then children sorted alphabetically.
 */
function sortCategoriesByHierarchy(categories: CategoryMonthlyData[]): CategoryMonthlyData[] {
  return categories.sort((a, b) => {
    if (!a.parentId && b.parentId) return -1;
    if (a.parentId && !b.parentId) return 1;
    return a.categoryName.localeCompare(b.categoryName);
  });
}

export const financialOverviewApi = {
  /**
   * Get financial overview data with categories grouped by type.
   *
   * Returns DataResult for explicit success/failure handling.
   */
  getOverview: async (
    monthsBack: number = DATABASE.MONTHS_BACK.DEFAULT
  ): Promise<DataResult<FinancialOverviewData, DashboardRepositoryError | DashboardValidationError>> => {
    try {
      const supabase = createClient();

      // 1. Get main currency from user settings (RLS handles user filtering)
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('main_currency')
        .maybeSingle();

      const mainCurrency = settingsData?.main_currency || CURRENCY.DEFAULT;

      // 2. Fetch all categories for parent-child relationships and type
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, color, parent_id, type')
        .order('name', { ascending: true });

      if (categoriesError) {
        return {
          success: false,
          data: null,
          error: new DashboardRepositoryError(
            categoriesError.message || 'Failed to fetch categories',
            categoriesError
          ),
        };
      }

      // 3. Call RPC to get monthly spending data
      const { data: rawData, error: rpcError } = await supabase.rpc(
        'get_monthly_spending_by_category',
        { p_months_back: monthsBack }
      );

      if (rpcError) {
        return {
          success: false,
          data: null,
          error: new DashboardRepositoryError(
            rpcError.message || 'Failed to fetch monthly spending',
            rpcError
          ),
        };
      }

      // 4. Zod validation at network boundary
      try {
        const validatedSpending = z.array(MonthlySpendingRpcRowSchema).parse(rawData ?? []);

        // Build categories lookup for transformer
        const categoriesLookup = new Map<string, CategoryLookupEntry>(
          (categoriesData || []).map(cat => [
            cat.id,
            {
              type: cat.type as 'income' | 'expense',
              parent_id: cat.parent_id,
              name: cat.name,
              color: cat.color,
            },
          ])
        );

        // Transform using centralized Domain Guard transformer
        const allCategories = dbMonthlySpendingToDomain(
          validatedSpending as MonthlySpendingDbRow[],
          categoriesLookup
        );

        // Separate by type and sort by hierarchy
        const incomeCategories = sortCategoriesByHierarchy(
          allCategories.filter(cat => cat.categoryType === 'income')
        );

        const expenseCategories = sortCategoriesByHierarchy(
          allCategories.filter(cat => cat.categoryType === 'expense')
        );

        return {
          success: true,
          data: {
            incomeCategories,
            expenseCategories,
            mainCurrency,
          },
        };
      } catch (validationError) {
        return {
          success: false,
          data: null,
          error: new DashboardValidationError(
            validationError instanceof Error
              ? validationError.message
              : 'Financial overview data validation failed',
            validationError
          ),
        };
      }
    } catch (err) {
      // Unexpected error - report to Sentry
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'dashboard',
        { operation: 'getOverview', monthsBack }
      );
      return {
        success: false,
        data: null,
        error: new DashboardRepositoryError(
          'Unexpected error fetching financial overview',
          err
        ),
      };
    }
  },
};
