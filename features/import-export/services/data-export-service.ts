import { utils, writeFile } from 'xlsx';
import type { IExportProvider } from '@/domain';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';

/**
 * Data Export Service
 *
 * Aggregates data from all registered IExportProvider implementations
 * and generates an Excel workbook.
 *
 * ARCHITECTURE: Bridge Pattern (MANIFESTO §5 Compliant)
 * - Depends only on IExportProvider interface from @/domain
 * - No direct imports from other features
 * - Features "volunteer" data via their provider implementations
 *
 * @module data-export-service
 */
export class DataExportService {
  constructor(
    private readonly providers: IExportProvider[],
    private readonly authProvider: IAuthProvider
  ) {}

  /**
   * Export all registered feature data to an Excel workbook.
   *
   * Each provider contributes a separate sheet in the workbook.
   * Empty data sets are skipped (no empty sheets).
   */
  async exportToExcel(): Promise<void> {
    const userId = await this.authProvider.getCurrentUserId();
    const workbook = utils.book_new();

    for (const provider of this.providers) {
      const result = await provider.getExportPayload(userId);

      if (result.success && result.data.length > 0) {
        const worksheet = utils.json_to_sheet(result.data);
        utils.book_append_sheet(workbook, worksheet, provider.sheetName);
      }
    }

    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `finance_tracker_export_${dateStr}.xlsx`;

    // Trigger download
    writeFile(workbook, filename);
  }
}
