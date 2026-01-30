/**
 * Main Currency Service
 *
 * Lib-level orchestrator for fetching user's main currency preference.
 * Decoupled from settings feature to avoid context → feature dependency.
 *
 * Architecture:
 * - Follows IOC injection pattern for iOS parity
 * - Uses transformer at boundary for Data Border Control
 * - PGRST116 Protection via .maybeSingle()
 *
 * @module lib/api/main-currency-service
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { dbMainCurrencyToDomain } from '@/lib/data/data-transformers';
import { CURRENCY } from '@/lib/constants';

/**
 * Main currency data returned by the service
 */
export interface MainCurrencyData {
  mainCurrency: string;
}

/**
 * Main Currency Service
 *
 * Fetches user's main currency preference with IOC injection.
 * Returns default currency for unauthenticated users or missing settings.
 *
 * Swift Mirror:
 * ```swift
 * class MainCurrencyService {
 *     private let supabase: SupabaseClient
 *     private let authProvider: AuthProviderProtocol
 *
 *     init(supabase: SupabaseClient, authProvider: AuthProviderProtocol) {
 *         self.supabase = supabase
 *         self.authProvider = authProvider
 *     }
 *
 *     func getMainCurrency() async throws -> MainCurrencyData {
 *         guard try await authProvider.isAuthenticated() else {
 *             return MainCurrencyData(mainCurrency: Currency.default)
 *         }
 *         // Query user_settings...
 *     }
 * }
 * ```
 */
export class MainCurrencyService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly authProvider: IAuthProvider
  ) {}

  /**
   * Get main currency for the current user.
   *
   * GRACEFUL IDENTITY: Returns default currency for:
   * - Unauthenticated users
   * - Users without settings row (PGRST116 protection)
   * - Invalid/corrupted currency values
   *
   * @returns MainCurrencyData with validated currency code
   */
  async getMainCurrency(): Promise<MainCurrencyData> {
    // Check auth first - return default if not authenticated
    const isAuthenticated = await this.authProvider.isAuthenticated();
    if (!isAuthenticated) {
      return { mainCurrency: CURRENCY.DEFAULT };
    }

    // Query user_settings with RLS (filters by authenticated user)
    // PGRST116 PROTECTION: Use .maybeSingle() to handle missing rows gracefully
    const { data, error } = await this.supabase
      .from('user_settings')
      .select('main_currency')
      .maybeSingle();

    if (error) {
      console.error('Error fetching main currency:', error);
      // Return default on error - don't throw to avoid breaking UI
      return { mainCurrency: CURRENCY.DEFAULT };
    }

    // DATA BORDER CONTROL: Transform at boundary with validation
    const mainCurrency = dbMainCurrencyToDomain(
      data?.main_currency,
      CURRENCY.DEFAULT
    );

    return { mainCurrency };
  }
}

/**
 * Factory function to create MainCurrencyService with proper DI.
 *
 * @param supabase - Supabase client instance
 * @returns MainCurrencyService instance
 *
 * @example
 * ```typescript
 * import { createClient } from '@/lib/supabase/client';
 * import { createMainCurrencyService } from '@/lib/api/main-currency-service';
 *
 * const service = createMainCurrencyService(createClient());
 * const { mainCurrency } = await service.getMainCurrency();
 * ```
 */
export function createMainCurrencyService(supabase: SupabaseClient): MainCurrencyService {
  const authProvider = createSupabaseAuthProvider(supabase);
  return new MainCurrencyService(supabase, authProvider);
}
