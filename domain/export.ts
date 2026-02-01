/**
 * Export Domain - Provider Interface
 *
 * Defines the contract for features that want to participate in global data export.
 * This enables cross-cutting export functionality without violating folder-by-feature
 * boundaries (MANIFESTO §5).
 *
 * ARCHITECTURE PATTERN: Bridge Pattern
 * - DataExportService depends only on this interface
 * - Features implement IExportProvider within their own boundaries
 * - No direct feature-to-feature imports required
 *
 * Swift Protocol Mirror: ExportProvider
 *
 * @module domain/export
 */

import type { DataResult } from '@/lib/data-patterns';

/**
 * Row format for exported data.
 *
 * Each feature defines its own column structure within this flexible format.
 * The export service treats these as opaque rows for Excel generation.
 *
 * Swift Mirror:
 * ```swift
 * typealias ExportRow = [String: Any]
 * ```
 */
export interface ExportRow {
  readonly [key: string]: string | number | boolean | null;
}

/**
 * Provider interface for features that support data export.
 *
 * Any feature wanting to be included in a global data export must implement
 * this interface. This allows the export service to aggregate data from
 * multiple features without knowing their internals.
 *
 * Swift Protocol Mirror:
 * ```swift
 * protocol ExportProvider {
 *     var featureId: String { get }
 *     var sheetName: String { get }
 *     func getExportPayload(userId: String) async -> DataResult<[ExportRow]>
 * }
 * ```
 *
 * Usage:
 * ```typescript
 * class TransactionExportProvider implements IExportProvider {
 *   readonly featureId = 'transactions';
 *   readonly sheetName = 'Transactions';
 *
 *   async getExportPayload(userId: string) {
 *     const result = await this.repository.getAll(userId);
 *     if (!result.success) return result;
 *     return { success: true, data: result.data.map(transformToRow) };
 *   }
 * }
 * ```
 */
export interface IExportProvider {
  /**
   * Unique identifier for this feature's data in the export bundle.
   * Used for internal tracking and logging.
   */
  readonly featureId: string;

  /**
   * Human-readable name for the Excel sheet.
   * This appears as the tab name in the exported workbook.
   */
  readonly sheetName: string;

  /**
   * Fetch all exportable data for this feature.
   *
   * @param userId - The authenticated user's ID
   * @returns DataResult containing export rows or error
   */
  getExportPayload(userId: string): Promise<DataResult<ExportRow[]>>;
}
