import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { MonthlySpendingTable } from '@/features/transactions/components/monthly-spending-table';

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
      <div className="container mx-auto px-4 py-8">
        <MonthlySpendingTable />
      </div>
    </DashboardLayout>
  );
}
