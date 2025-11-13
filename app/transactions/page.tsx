import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AllTransactionsTable } from '@/features/transactions/components/all-transactions-table';

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            All Transactions
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            View all your transactions across all accounts
          </p>
        </div>
        <AllTransactionsTable />
      </div>
    </DashboardLayout>
  );
}
