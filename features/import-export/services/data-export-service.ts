import { utils, writeFile } from 'xlsx';
import { createClient } from '@/lib/supabase/client';

export class DataExportService {
    private supabase = createClient();

    async exportToExcel() {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Fetch all transactions with related data
        const { data: transactions, error } = await this.supabase
            .from('transactions')
            .select(`
        date,
        amount_original,
        description,
        notes,
        exchange_rate,
        currency_original,
        categories (name),
        bank_accounts (name)
      `)
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (error) throw new Error(`Failed to fetch data: ${error.message}`);

        // Format data for Excel
        const rows = transactions.map(t => ({
            Date: t.date,
            Amount: t.amount_original,
            Description: t.description,
            Category: t.categories?.name || '',
            Account: t.bank_accounts?.name || '',
            Currency: t.currency_original,
            'Exchange Rate': t.exchange_rate,
            Notes: t.notes
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
