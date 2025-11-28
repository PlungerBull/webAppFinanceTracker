import { createClient } from '@/lib/supabase/client';
import { CURRENCY } from '@/lib/constants';

export const currenciesApi = {
  /**
   * Get all global currencies (read-only, no user filtering needed)
   */
  getAll: async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('global_currencies')
      .select('*')
      .order('code', { ascending: true });

    if (error) {
      console.error(CURRENCY.API.CONSOLE.FETCH_CURRENCIES, error);
      throw new Error(error.message || CURRENCY.API.ERRORS.FETCH_ALL_FAILED);
    }

    return data || [];
  },
};
