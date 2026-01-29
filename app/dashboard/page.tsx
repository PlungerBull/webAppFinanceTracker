import { redirect } from 'next/navigation';
import { isServerAuthenticated } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DashboardContent } from '@/features/dashboard/components/dashboard-content';
import { SentryErrorBoundary } from '@/components/sentry-error-boundary';

export default async function DashboardPage() {
  if (!(await isServerAuthenticated())) {
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
