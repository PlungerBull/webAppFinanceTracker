import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { InboxTable } from '@/features/inbox/components/inbox-table';
import { SentryErrorBoundary } from '@/components/sentry-error-boundary';

export default async function InboxPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
