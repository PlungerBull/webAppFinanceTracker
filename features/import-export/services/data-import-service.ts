import { read, utils } from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { ACCOUNT, CATEGORY, IMPORT_EXPORT } from '@/lib/constants';

export interface ImportResult {
    total: number;
    success: number;
    failed: number;
    errors: string[];
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
    private supabase = createClient();

    async importFromExcel(file: File): Promise<ImportResult> {
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
            const processedRows = rows.map((row, index) => {
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
                } catch (e) {
                    // If date parsing fails here, we can't send it to RPC easily as a valid date
                    // We'll let the RPC or this map fail?
                    // Better to filter out invalid rows or handle them?
                    // For now, let's just return the row and let RPC fail or validation fail
                    return { ...row, Date: String(row.Date) };
                }
            });

            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) throw new Error(IMPORT_EXPORT.ERRORS.USER_NOT_AUTHENTICATED);

            // Call RPC
            const { data, error } = await this.supabase.rpc(IMPORT_EXPORT.RPC.IMPORT_TRANSACTIONS, {
                [IMPORT_EXPORT.RPC.PARAMS.USER_ID]: user.id,
                [IMPORT_EXPORT.RPC.PARAMS.TRANSACTIONS]: processedRows,
                [IMPORT_EXPORT.RPC.PARAMS.DEFAULT_ACCOUNT_COLOR]: ACCOUNT.DEFAULT_COLOR,
                [IMPORT_EXPORT.RPC.PARAMS.DEFAULT_CATEGORY_COLOR]: CATEGORY.DEFAULT_COLOR
            });

            if (error) throw new Error(IMPORT_EXPORT.ERRORS.RPC_CALL_FAILED(error.message));

            // Parse result
            // The RPC returns { success: number, failed: number, errors: string[] }
            const rpcResult = data as { success: number; failed: number; errors: string[] };

            result.success = rpcResult.success;
            result.failed = rpcResult.failed;
            result.errors = rpcResult.errors;

        } catch (error) {
            result.errors.push(IMPORT_EXPORT.ERRORS.FILE_PROCESSING_ERROR(error instanceof Error ? error.message : IMPORT_EXPORT.ERRORS.UNKNOWN_ERROR));
        }

        return result;
    }
}
