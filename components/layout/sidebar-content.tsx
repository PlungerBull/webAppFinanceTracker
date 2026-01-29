'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTransactionModal } from '@/features/transactions/contexts/transaction-modal-context';
import { UserMenu } from '@/components/layout/user-menu';
import { MainNavigation } from '@/components/layout/main-navigation';
import { AccountList } from '@/features/accounts/components/account-list';
import { GroupingList } from '@/features/groupings/components/grouping-list';
import { SentryErrorBoundary } from '@/components/sentry-error-boundary';

interface SidebarContentProps {
  isCollapsed?: boolean;
  onCloseMobile?: () => void;
}

/**
 * SidebarContent - The inner contents of the sidebar
 * Extracted for DRY compliance between desktop (aside) and mobile (Sheet) rendering
 */
export function SidebarContent({ isCollapsed = false, onCloseMobile }: SidebarContentProps) {
  const { openTransactionModal } = useTransactionModal();

  const handleNewTransaction = () => {
    openTransactionModal();
    onCloseMobile?.();
  };

  return (
    <>
      {/* Zone A: Fixed Content (User Menu + Main Nav) */}
      <div className="flex flex-col flex-shrink-0 border-b border-gray-200">
        {/* Header - User Menu */}
        <div className="flex items-center pl-4 py-4 pr-1">
          <UserMenu isCollapsed={isCollapsed} />
        </div>

        {/* New Transaction Button */}
        {!isCollapsed && (
          <div className="px-4 pb-4">
            <Button
              onClick={handleNewTransaction}
              variant="outline"
              className="w-full justify-start h-9 px-0 py-2 border-gray-200 hover:bg-white hover:border-gray-300 hover:text-gray-900 text-gray-700 shadow-sm hover:shadow transition-all group"
            >
              <div className="mx-2 h-5 w-5 rounded bg-white border border-blue-200 flex items-center justify-center group-hover:border-blue-300 transition-colors">
                <Plus className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <span className="font-medium">New Transaction</span>
            </Button>
          </div>
        )}

        {/* Main Navigation */}
        <div className="px-2 pb-2">
          <MainNavigation isCollapsed={isCollapsed} />
        </div>
      </div>

      {/* Zone B: Scrollable Content (Accounts + Groupings) */}
      <nav className="flex-1 overflow-y-auto p-2 scrollbar-hide">
        {!isCollapsed && (
          <>
            <SentryErrorBoundary domain="accounts" fallbackMessage="Could not load accounts.">
              <AccountList />
            </SentryErrorBoundary>
            <GroupingList />
          </>
        )}
      </nav>
    </>
  );
}
