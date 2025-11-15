import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AccountTransactionsTable } from '@/features/transactions/components/account-transactions-table';

interface AccountPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch account details
  const { data: account } = await supabase
    .from('bank_accounts')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!account) {
    redirect('/dashboard');
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {account.name}
          </h1>
        </div>
        <AccountTransactionsTable accountId={id} />
      </div>
    </DashboardLayout>
  );
}
