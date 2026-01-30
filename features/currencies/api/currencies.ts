import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { CURRENCY } from '@/lib/constants';
import { dbCurrenciesToDomain } from '@/lib/data/data-transformers';
import { GlobalCurrencyRowSchema } from '@/lib/data/db-row-schemas';

export const currenciesApi = {
  /**
   * Get all global currencies (read-only, no user filtering needed)
   * HARDENED: Zod validation at network boundary
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

    // HARDENED: Zod validation at network boundary
    const validated = z.array(GlobalCurrencyRowSchema).parse(data ?? []);

    // Transform snake_case to camelCase before returning to frontend
    return dbCurrenciesToDomain(validated);
  },
};
