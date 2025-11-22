import { read, utils } from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { ACCOUNT, CATEGORY } from '@/lib/constants';

export interface ImportResult {
    total: number;
    success: number;
    failed: number;
    errors: string[];
}

interface ImportRow {
    Date: string | number;
    Amount: number;
    Description?: string;
    Category?: string;
    Account: string;
    Currency?: string;
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
                result.errors.push('File is empty');
                return result;
            }

            // Pre-process dates to ensure they are strings before sending to RPC
            // RPC expects "Date" as text in YYYY-MM-DD format
            const processedRows = rows.map((row, index) => {
                try {
                    let dateStr: string;
                    if (!row.Date) throw new Error('Date is required');

                    if (typeof row.Date === 'number') {
                        // Excel serial date
                        const date = new Date((row.Date - (25567 + 2)) * 86400 * 1000);
                        dateStr = date.toISOString().split('T')[0];
                    } else {
                        // String date
                        const date = new Date(row.Date);
                        if (isNaN(date.getTime())) throw new Error(`Invalid date format: ${row.Date}`);
                        dateStr = date.toISOString().split('T')[0];
                    }

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
            if (!user) throw new Error('User not authenticated');

            // Call RPC
            const { data, error } = await this.supabase.rpc('import_transactions', {
                p_user_id: user.id,
                p_transactions: processedRows,
                p_default_account_color: ACCOUNT.DEFAULT_COLOR,
                p_default_category_color: CATEGORY.DEFAULT_COLOR
            });

            if (error) throw new Error(`RPC call failed: ${error.message}`);

            // Parse result
            // The RPC returns { success: number, failed: number, errors: string[] }
            const rpcResult = data as { success: number; failed: number; errors: string[] };

            result.success = rpcResult.success;
            result.failed = rpcResult.failed;
            result.errors = rpcResult.errors;

        } catch (error) {
            result.errors.push(`File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }
}
