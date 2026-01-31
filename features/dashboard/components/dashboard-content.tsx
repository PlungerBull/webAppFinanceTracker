'use client';

import { PageHeader } from '@/components/layout/page-header';
import { FinancialOverview } from './financial-overview';
import { useSidebar } from '@/contexts/sidebar-context';

export function DashboardContent() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Financial Trends" sidebarCollapsed={isCollapsed} />
      <div className="flex-1 overflow-hidden">
        <FinancialOverview />
      </div>
    </div>
  );
}
