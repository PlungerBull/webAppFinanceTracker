import { redirect } from 'next/navigation';
import { isServerAuthenticated } from '@/lib/auth/server';
import { AllTransactionsTable } from '@/features/transactions/components/all-transactions-table';
import { SentryErrorBoundary } from '@/components/sentry-error-boundary';

export default async function TransactionsPage() {
  if (!(await isServerAuthenticated())) {
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
