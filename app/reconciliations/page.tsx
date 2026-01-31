import { redirect } from 'next/navigation';
import { isServerAuthenticated } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ReconciliationSettings } from '@/features/reconciliations/components/settings/reconciliation-settings';

export default async function ReconciliationsPage() {
  if (!(await isServerAuthenticated())) {
    redirect('/login');
  }

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto py-12 px-8">
          <ReconciliationSettings />
        </div>
      </div>
    </DashboardLayout>
  );
}
