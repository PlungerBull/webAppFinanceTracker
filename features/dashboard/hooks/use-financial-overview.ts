import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { CURRENCY, DATABASE, QUERY_KEYS } from '@/lib/constants';
import {
  dbMonthlySpendingToDomain,
  type CategoryMonthlyData,
  type MonthlySpendingDbRow,
  type CategoryLookupEntry,
} from '@/lib/data/data-transformers';

// Re-export for consumers that import from this hook
export type { CategoryMonthlyData };

export interface FinancialOverviewData {
  incomeCategories: CategoryMonthlyData[];
  expenseCategories: CategoryMonthlyData[];
  mainCurrency: string;
}

/**
 * Sorts categories by parent-child hierarchy and name
 * Parents come first, then children sorted alphabetically
 */
function sortCategoriesByHierarchy(categories: CategoryMonthlyData[]): CategoryMonthlyData[] {
  return categories.sort((a, b) => {
    // Parents first, then children
    if (!a.parentId && b.parentId) return -1;
    if (a.parentId && !b.parentId) return 1;
    // Sort alphabetically within same level
    return a.categoryName.localeCompare(b.categoryName);
  });
}

/**
 * Custom hook to fetch financial overview data with categories grouped by type (income/expense)
 * and organized by parent-child hierarchy
 * @param monthsBack - Number of months to fetch data for (default: 6)
 * @returns Query result with income and expense categories with monthly data
 */
export function useFinancialOverview(monthsBack = DATABASE.MONTHS_BACK.DEFAULT) {
  return useQuery<FinancialOverviewData>({
    queryKey: QUERY_KEYS.TRANSACTIONS.MONTHLY_SPENDING(monthsBack),
    queryFn: async () => {
      const supabase = createClient();

      // Get main currency from user settings (RLS handles user filtering)
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('main_currency')
        .maybeSingle();

      const mainCurrency = settingsData?.main_currency || CURRENCY.DEFAULT;

      // Fetch all categories to get the parent-child relationships and type
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, color, parent_id, type')
        .order('name', { ascending: true });

      if (categoriesError) {
        console.error('Error fetching categories:', categoriesError);
        throw categoriesError;
      }

      // Call database function to get monthly spending data
      const { data: rawData, error } = await supabase
        .rpc('get_monthly_spending_by_category', {
          p_months_back: monthsBack,
        });

      if (error) {
        console.error('Error fetching monthly spending:', error);
        throw error;
      }

      // Build categories lookup for the transformer
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
        (rawData || []) as MonthlySpendingDbRow[],
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
        incomeCategories,
        expenseCategories,
        mainCurrency,
      };
    },
  });
}
