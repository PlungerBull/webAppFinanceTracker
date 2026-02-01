/**
 * Transaction Export Provider
 *
 * Implements IExportProvider to volunteer transaction data for global export.
 * This keeps export logic within the transactions feature boundary, following
 * MANIFESTO §5 (Folder-by-Feature Organization).
 *
 * ARCHITECTURE: Bridge Pattern
 * - DataExportService depends only on IExportProvider (from @/domain)
 * - This provider lives in transactions feature (its natural home)
 * - No cross-feature imports required
 *
 * Swift Protocol Mirror: TransactionExportProvider
 *
 * @module transaction-export-provider
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IExportProvider, ExportRow } from '@/domain';
import type { DataResult } from '@/lib/data-patterns';
import { createTransactionRepository } from '../repository';

/**
 * Provider that exports transaction data for global data export.
 *
 * Transforms domain entities to export-friendly rows, converting
 * integer cents to decimal amounts for human-readable Excel output.
 */
export class TransactionExportProvider implements IExportProvider {
  readonly featureId = 'transactions';
  readonly sheetName = 'Transactions';

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Fetch all transactions for export.
   *
   * @param userId - The authenticated user's ID
   * @returns DataResult containing export rows or error
   */
  async getExportPayload(userId: string): Promise<DataResult<ExportRow[]>> {
    const repository = createTransactionRepository(this.supabase);
    const result = await repository.getAllPaginated(
      userId,
      {},
      { offset: 0, limit: 10000 }
    );

    if (!result.success) {
      return result;
    }

    // Transform domain entities to export rows
    // Convert INTEGER CENTS → DECIMAL for human-readable export
    const rows: ExportRow[] = result.data.data.map((t) => ({
      Date: t.date,
      Amount: t.amountCents / 100,
      Description: t.description || '',
      Category: t.categoryName || '',
      Account: t.accountName,
      Currency: t.currencyOriginal,
      'Exchange Rate': t.exchangeRate,
      Notes: t.notes || '',
    }));

    return { success: true, data: rows };
  }
}

/**
 * Factory function for creating TransactionExportProvider
 *
 * Follows CTO Mandate #5: Real Dependency Injection (NOT Singletons)
 *
 * @param supabase - Supabase client instance
 * @returns IExportProvider implementation
 *
 * @example
 * ```typescript
 * const supabase = createClient();
 * const provider = createTransactionExportProvider(supabase);
 *
 * // Pass to DataExportService
 * const exportService = new DataExportService([provider], authProvider);
 * ```
 */
export function createTransactionExportProvider(
  supabase: SupabaseClient
): IExportProvider {
  return new TransactionExportProvider(supabase);
}
