import { utils, writeFile } from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { dbTransactionViewsToDomain } from '@/lib/types/data-transformers';

export class DataExportService {
    private supabase = createClient();

    async exportToExcel() {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Fetch all transactions with related data using view
        const { data: dbTransactions, error } = await this.supabase
            .from('transactions_view')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (error) throw new Error(`Failed to fetch data: ${error.message}`);

        // Transform database rows to domain objects
        const transactions = dbTransactionViewsToDomain(dbTransactions);

        // Format domain objects for Excel
        const rows = transactions.map(t => ({
            Date: t.date,
            Amount: t.amountOriginal,
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
