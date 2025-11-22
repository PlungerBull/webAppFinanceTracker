'use client';

import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/sidebar-context';
import { UserMenu } from '@/components/layout/user-menu';
import { MainNavigation } from '@/components/layout/main-navigation';
import { AccountList } from '@/features/accounts/components/account-list';
import { CategoryList } from '@/features/categories/components/category-list';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 relative',
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
          <div className="flex flex-col flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">
            {/* Header - User Menu */}
            <div className="flex items-center pl-4 py-4 pr-1">
              <UserMenu isCollapsed={isCollapsed} />
            </div>

            {/* Main Navigation */}
            <div className="px-2 pb-2">
              <MainNavigation isCollapsed={isCollapsed} />
            </div>
          </div>

          {/* Zone B: Scrollable Content (Accounts + Categories) */}
          <nav className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {!isCollapsed && (
              <>
                <AccountList />
                <div className="my-4 border-t border-zinc-100 dark:border-zinc-800/50" />
                <CategoryList />
              </>
            )}
          </nav>
        </>
      )}
    </aside>
  );
}