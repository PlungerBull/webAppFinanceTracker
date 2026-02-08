import { read, utils } from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import { ACCOUNT, CATEGORY, IMPORT_EXPORT } from '@/lib/constants';
import { validateOrThrow } from '@/lib/data/validate';
import { ImportResultRpcSchema } from '@/lib/data/db-row-schemas';
import { chunkArray } from '@/lib/utils/array-utils';

export interface ImportResult {
    total: number;
    success: number;
    failed: number;
    errors: string[];
}

/** Progress state passed to the onProgress callback */
export interface ImportProgress {
    /** 1-based index of the chunk currently being uploaded */
    currentChunk: number;
    /** Total number of chunks */
    totalChunks: number;
    /** Cumulative success count so far */
    successSoFar: number;
    /** Cumulative failed count so far */
    failedSoFar: number;
    /** Total rows being imported */
    totalRows: number;
}

/** Options for the import method */
export interface ImportOptions {
    /** Called after each chunk completes. Receives cumulative progress. */
    onProgress?: (progress: ImportProgress) => void;
    /** Number of rows per chunk. Defaults to IMPORT_EXPORT.CHUNK.SIZE (500). */
    chunkSize?: number;
}

interface ImportRow {
    Date: string | number;
    Amount: number;
    Description: string;
    Category: string;
    Account: string;
    Currency: string;
    'Exchange Rate'?: number;
    Notes?: string;
}

export class DataImportService {
    constructor(
        private readonly supabase: SupabaseClient,
        private readonly authProvider: IAuthProvider
    ) {}

    async importFromFile(file: File, options?: ImportOptions): Promise<ImportResult> {
        const result: ImportResult = {
            total: 0,
            success: 0,
            failed: 0,
            errors: [],
        };

        try {
            const buffer = await file.arrayBuffer();
            const workbook = read(buffer);

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const rows = utils.sheet_to_json<ImportRow>(sheet);
            result.total = rows.length;

            if (rows.length === 0) {
                result.errors.push(IMPORT_EXPORT.ERRORS.FILE_EMPTY);
                return result;
            }

            // Pre-process dates to ensure they are strings before sending to RPC
            // RPC expects "Date" as text in YYYY-MM-DD format
            const processedRows = rows.map((row, _index) => {
                try {
                    let dateStr: string;
                    if (!row.Date) throw new Error(IMPORT_EXPORT.ERRORS.DATE_REQUIRED);

                    if (typeof row.Date === 'number') {
                        // Excel serial date
                        const date = new Date((row.Date - (IMPORT_EXPORT.EXCEL.EPOCH_OFFSET + IMPORT_EXPORT.EXCEL.DATE_ADJUSTMENT)) * IMPORT_EXPORT.EXCEL.SECONDS_PER_DAY * IMPORT_EXPORT.EXCEL.MS_MULTIPLIER);
                        dateStr = date.toISOString().split('T')[0];
                    } else {
                        // String date
                        const date = new Date(row.Date);
                        if (isNaN(date.getTime())) throw new Error(IMPORT_EXPORT.ERRORS.INVALID_DATE_FORMAT(row.Date));
                        dateStr = date.toISOString().split('T')[0];
                    }

                    // Validate other required fields
                    if (!row.Description) throw new Error(IMPORT_EXPORT.ERRORS.DESCRIPTION_REQUIRED);
                    if (!row.Category) throw new Error(IMPORT_EXPORT.ERRORS.CATEGORY_REQUIRED);
                    if (!row.Currency) throw new Error(IMPORT_EXPORT.ERRORS.CURRENCY_REQUIRED);

                    return {
                        ...row,
                        Date: dateStr
                    };
                } catch {
                    return { ...row, Date: String(row.Date) };
                }
            });

            const userId = await this.authProvider.getCurrentUserId();

            // Split into chunks and send sequentially
            const chunkSize = options?.chunkSize ?? IMPORT_EXPORT.CHUNK.SIZE;
            const chunks = chunkArray(processedRows, chunkSize);

            for (let i = 0; i < chunks.length; i++) {
                const { data, error } = await this.supabase.rpc(IMPORT_EXPORT.RPC.IMPORT_TRANSACTIONS, {
                    [IMPORT_EXPORT.RPC.PARAMS.USER_ID]: userId,
                    [IMPORT_EXPORT.RPC.PARAMS.TRANSACTIONS]: chunks[i],
                    [IMPORT_EXPORT.RPC.PARAMS.DEFAULT_ACCOUNT_COLOR]: ACCOUNT.DEFAULT_COLOR,
                    [IMPORT_EXPORT.RPC.PARAMS.DEFAULT_CATEGORY_COLOR]: CATEGORY.DEFAULT_COLOR,
                    p_general_label: 'General',
                    p_uncategorized_label: 'Uncategorized'
                });

                if (error) {
                    // Network/RPC-level failure: stop sending further chunks
                    result.errors.push(
                        IMPORT_EXPORT.ERRORS.CHUNK_NETWORK_ERROR(i + 1, chunks.length, error.message)
                    );
                    result.errors.push(
                        IMPORT_EXPORT.ERRORS.IMPORT_ABORTED_PARTIAL(result.success, result.total)
                    );
                    break;
                }

                // Validate and parse RPC result at the network boundary
                const rpcResult = validateOrThrow(ImportResultRpcSchema, data, 'ImportResultRpc');

                result.success += rpcResult.success;
                result.failed += rpcResult.failed;
                result.errors.push(...rpcResult.errors);

                // Notify caller of progress
                options?.onProgress?.({
                    currentChunk: i + 1,
                    totalChunks: chunks.length,
                    successSoFar: result.success,
                    failedSoFar: result.failed,
                    totalRows: result.total,
                });
            }

        } catch (error) {
            result.errors.push(IMPORT_EXPORT.ERRORS.FILE_PROCESSING_ERROR(error instanceof Error ? error.message : IMPORT_EXPORT.ERRORS.UNKNOWN_ERROR));
        }

        return result;
    }

    /** @deprecated Use importFromFile. Kept for backward compatibility. */
    async importFromExcel(file: File, options?: ImportOptions): Promise<ImportResult> {
        return this.importFromFile(file, options);
    }
}
