import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AllTransactionsTable } from '@/features/transactions/components/all-transactions-table';

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <AllTransactionsTable />;
}
