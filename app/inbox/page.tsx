import { redirect } from 'next/navigation';
import { isServerAuthenticated } from '@/lib/auth/server';
import { InboxTable } from '@/features/inbox/components/inbox-table';
import { SentryErrorBoundary } from '@/components/sentry-error-boundary';

export default async function InboxPage() {
  if (!(await isServerAuthenticated())) {
    redirect('/login');
  }

  return (
    <SentryErrorBoundary
      domain="inbox"
      fallbackMessage="Something went wrong loading your inbox. Please try refreshing."
    >
      <InboxTable />
    </SentryErrorBoundary>
  );
}
