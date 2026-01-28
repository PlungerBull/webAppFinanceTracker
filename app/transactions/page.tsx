import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AllTransactionsTable } from '@/features/transactions/components/all-transactions-table';
import { SentryErrorBoundary } from '@/components/sentry-error-boundary';

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <SentryErrorBoundary
      domain="transactions"
      fallbackMessage="Something went wrong loading your transactions. Please try refreshing."
    >
      <AllTransactionsTable />
    </SentryErrorBoundary>
  );
}
