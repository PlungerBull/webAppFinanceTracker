/**
 * Currencies API
 *
 * Read-only API for fetching global currency reference data.
 * Returns DataResult for S-Tier error handling across Native Bridge.
 *
 * @module features/currencies/api
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { CURRENCY } from '@/lib/constants';
import { dbCurrenciesToDomain } from '@/lib/data/data-transformers';
import { GlobalCurrencyRowSchema } from '@/lib/data/db-row-schemas';
import { reportError } from '@/lib/sentry/reporter';
import type { DataResult } from '@/lib/data-patterns';
import type { Currency } from '@/types/domain';
import {
  CurrencyRepositoryError,
  CurrencyValidationError,
} from '../domain/errors';

export const currenciesApi = {
  /**
   * Get all global currencies (read-only, no user filtering needed)
   *
   * Returns DataResult for explicit success/failure handling.
   * Empty array is a valid success state.
   */
  getAll: async (): Promise<DataResult<Currency[], CurrencyRepositoryError | CurrencyValidationError>> => {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('global_currencies')
        .select('*')
        .order('code', { ascending: true });

      if (error) {
        return {
          success: false,
          data: null,
          error: new CurrencyRepositoryError(
            error.message || CURRENCY.API.ERRORS.FETCH_ALL_FAILED,
            error
          ),
        };
      }

      // Zod validation at network boundary
      try {
        const validated = z.array(GlobalCurrencyRowSchema).parse(data ?? []);
        return {
          success: true,
          data: dbCurrenciesToDomain(validated),
        };
      } catch (validationError) {
        return {
          success: false,
          data: null,
          error: new CurrencyValidationError(
            validationError instanceof Error
              ? validationError.message
              : 'Currency data validation failed',
            validationError
          ),
        };
      }
    } catch (err) {
      // Unexpected error - report to Sentry
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'currencies',
        { operation: 'getAll' }
      );
      return {
        success: false,
        data: null,
        error: new CurrencyRepositoryError(
          'Unexpected error fetching currencies',
          err
        ),
      };
    }
  },
};
