'use client';

import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeft, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/sidebar-context';
import { useTransactionModal } from '@/features/transactions/contexts/transaction-modal-context';
import { UserMenu } from '@/components/layout/user-menu';
import { MainNavigation } from '@/components/layout/main-navigation';
import { AccountList } from '@/features/accounts/components/account-list';
import { GroupingList } from '@/features/groupings/components/grouping-list';


interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { openTransactionModal } = useTransactionModal();

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-gray-50/30 border-r border-gray-200 transition-all duration-300 relative',
        isCollapsed ? 'w-0' : 'w-64',
        className
      )}
    >
      {/* Collapse/Expand Button - Fixed position */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className={cn(
          'absolute top-4 z-50 h-8 w-8 transition-all duration-300',
          isCollapsed ? 'left-3' : 'left-[218px]'
        )}
      >
        {isCollapsed ? (
          <PanelLeft className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
      </Button>

      {/* Sidebar Content - Hidden when collapsed */}
      {!isCollapsed && (
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
                  onClick={openTransactionModal}
                  variant="outline"
                  className="w-full justify-start h-9 px-0 py-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 text-gray-700 shadow-sm hover:shadow transition-all group"
                >
                  <div className="mx-2 h-5 w-5 rounded bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Plus className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <span className="font-medium">New Testing Transaction</span>
                </Button>
              </div>
            )}

            {/* Main Navigation */}
            <div className="px-2 pb-2">
              <MainNavigation isCollapsed={isCollapsed} />
            </div>
          </div>

          {/* Zone B: Scrollable Content (Accounts + Groupings) */}
          <nav className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {!isCollapsed && (
              <>
                <AccountList />
                <GroupingList />
              </>
            )}
          </nav>
        </>
      )}
    </aside>
  );
}