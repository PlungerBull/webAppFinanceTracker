import { utils, writeFile } from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { createTransactionRepository } from '@/features/transactions/repository';

/**
 * Data Export Service
 *
 * Uses Repository Pattern for data access.
 * Converts integer cents back to decimal amounts for Excel export.
 */
export class DataExportService {
    private supabase = createClient();

    async exportToExcel() {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Use repository to fetch transactions (Repository Pattern)
        const repository = createTransactionRepository(this.supabase);
        const result = await repository.getAllPaginated(user.id, {}, { offset: 0, limit: 10000 });

        if (!result.success) {
            throw new Error(`Failed to fetch data: ${result.error.message}`);
        }

        const transactions = result.data.data;

        // Format domain entities for Excel
        // Convert INTEGER CENTS → DECIMAL for human-readable export
        const rows = transactions.map(t => ({
            Date: t.date,
            Amount: t.amountCents / 100, // Convert integer cents to decimal
            Description: t.description || '',
            Category: t.categoryName || '',
            Account: t.accountName,
            Currency: t.currencyOriginal,
            'Exchange Rate': t.exchangeRate,
            Notes: t.notes || ''
        }));

        // Create workbook and sheet
        const worksheet = utils.json_to_sheet(rows);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Transactions');

        // Generate filename with date
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `finance_tracker_export_${dateStr}.xlsx`;

        // Trigger download
        writeFile(workbook, filename);
    }
}
