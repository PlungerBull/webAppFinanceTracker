'use client';

import { PageHeader } from '@/components/layout/page-header';
import { FinancialOverview } from './financial-overview';
import { useSidebar } from '@/contexts/sidebar-context';
import { cn } from '@/lib/utils';

export function DashboardContent() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Financial Trends" sidebarCollapsed={isCollapsed} />
      <div className={cn(
        'flex-1 overflow-y-auto py-12 transition-all duration-300',
        isCollapsed ? 'px-32' : 'px-12'
      )}>
        <FinancialOverview />
      </div>
    </div>
  );
}
