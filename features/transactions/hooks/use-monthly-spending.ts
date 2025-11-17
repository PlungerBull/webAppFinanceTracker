import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { CURRENCY, DATABASE, QUERY_KEYS } from '@/lib/constants';

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  monthlyAmounts: { [key: string]: number };
}

export interface MonthlySpendingData {
  data: CategorySpending[];
  mainCurrency: string;
}

/**
 * Custom hook to fetch and transform monthly spending data by category
 * @param monthsBack - Number of months to fetch data for (default: 6)
 * @returns Query result with spending data grouped by category and main currency
 */
export function useMonthlySpending(monthsBack = DATABASE.MONTHS_BACK.DEFAULT) {
  return useQuery<MonthlySpendingData>({
    queryKey: QUERY_KEYS.TRANSACTIONS.MONTHLY_SPENDING(monthsBack),
    queryFn: async () => {
      const supabase = createClient();

      // Get main currency (RLS handles user filtering)
      const { data: currencyData } = await supabase
        .from('currencies')
        .select('code')
        .eq('is_main', DATABASE.MAIN_CURRENCY_FLAG)
        .maybeSingle();

      const mainCurrency = currencyData?.code || CURRENCY.DEFAULT;

      // Call database function (uses auth.uid() internally for security)
      const { data: rawData, error } = await supabase
        .rpc('get_monthly_spending_by_category', {
          p_months_back: monthsBack,
        });

      if (error) {
        console.error('Error fetching monthly spending:', error);
        throw error;
      }

      if (!rawData || rawData.length === 0) {
        return { data: [], mainCurrency };
      }

      // Transform flat data into grouped format for display
      const spendingByCategory: { [categoryId: string]: CategorySpending } = {};

      rawData.forEach((row: any) => {
        const categoryId = row.category_id;

        if (!spendingByCategory[categoryId]) {
          spendingByCategory[categoryId] = {
            categoryId: row.category_id,
            categoryName: row.category_name,
            categoryIcon: row.category_icon,
            monthlyAmounts: {},
          };
        }

        spendingByCategory[categoryId].monthlyAmounts[row.month_key] = row.total_amount;
      });

      const categoriesWithSpending = Object.values(spendingByCategory);

      return { data: categoriesWithSpending, mainCurrency };
    },
  });
}
