import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { CURRENCY, DATABASE, QUERY_KEYS } from '@/lib/constants';

interface MonthlySpendingRow {
  category_id: string;
  category_name: string;
  category_color: string;
  month_key: string;
  total_amount: number;
}

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  type: 'income' | 'expense';
}

export interface CategoryMonthlyData {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryType: 'income' | 'expense';
  parentId: string | null;
  monthlyAmounts: { [key: string]: number };
}

export interface FinancialOverviewData {
  incomeCategories: CategoryMonthlyData[];
  expenseCategories: CategoryMonthlyData[];
  mainCurrency: string;
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

      // Create a map of categories by ID for quick lookup
      const categoriesMap = new Map<string, CategoryRow>();
      (categoriesData || []).forEach((cat: CategoryRow) => {
        categoriesMap.set(cat.id, cat);
      });

      // Transform flat data into grouped format
      const categoryDataMap: { [categoryId: string]: CategoryMonthlyData } = {};

      (rawData || []).forEach((row: MonthlySpendingRow) => {
        const categoryId = row.category_id;
        const category = categoriesMap.get(categoryId);

        if (!categoryDataMap[categoryId]) {
          categoryDataMap[categoryId] = {
            categoryId: row.category_id,
            categoryName: row.category_name,
            categoryColor: row.category_color,
            categoryType: category?.type || 'expense',
            parentId: category?.parent_id || null,
            monthlyAmounts: {},
          };
        }

        categoryDataMap[categoryId].monthlyAmounts[row.month_key] = row.total_amount;
        categoryDataMap[categoryId].monthlyAmounts[row.month_key] = row.total_amount;
      });

      // Ensure parents exist for all children
      Object.values(categoryDataMap).forEach((cat) => {
        if (cat.parentId && !categoryDataMap[cat.parentId]) {
          const parent = categoriesMap.get(cat.parentId);
          if (parent) {
            categoryDataMap[parent.id] = {
              categoryId: parent.id,
              categoryName: parent.name,
              categoryColor: parent.color,
              categoryType: parent.type,
              parentId: parent.parent_id,
              monthlyAmounts: {},
            };
          }
        }
      });

      const allCategories = Object.values(categoryDataMap);

      // Separate by type and organize by parent-child hierarchy
      const incomeCategories = allCategories
        .filter(cat => cat.categoryType === 'income')
        .sort((a, b) => {
          // Parents first, then children
          if (!a.parentId && b.parentId) return -1;
          if (a.parentId && !b.parentId) return 1;
          // Sort alphabetically within same level
          return a.categoryName.localeCompare(b.categoryName);
        });

      const expenseCategories = allCategories
        .filter(cat => cat.categoryType === 'expense')
        .sort((a, b) => {
          // Parents first, then children
          if (!a.parentId && b.parentId) return -1;
          if (a.parentId && !b.parentId) return 1;
          // Sort alphabetically within same level
          return a.categoryName.localeCompare(b.categoryName);
        });

      return {
        incomeCategories,
        expenseCategories,
        mainCurrency,
      };
    },
  });
}
