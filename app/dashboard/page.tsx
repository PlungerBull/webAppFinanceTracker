import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DashboardContent } from '@/features/dashboard/components/dashboard-content';
import { SentryErrorBoundary } from '@/components/sentry-error-boundary';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardLayout>
      <SentryErrorBoundary
        domain="dashboard"
        fallbackMessage="Something went wrong loading the dashboard. Please try refreshing."
      >
        <DashboardContent />
      </SentryErrorBoundary>
    </DashboardLayout>
  );
}
