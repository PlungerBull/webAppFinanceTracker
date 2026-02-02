'use client';

import { Sidebar } from './sidebar';
import { MobileHeader } from './mobile-header';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { SyncConflictBanner } from '@/components/sync-conflict-banner';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex flex-col md:flex-row h-dvh overflow-hidden bg-white dark:bg-zinc-900">
        {/* Mobile Header - only visible on mobile */}
        <MobileHeader />

        {/* Sidebar - handles its own responsive behavior (Sheet on mobile, aside on desktop) */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative">
          {/* Sync Conflict Banner - shows when data can't sync */}
          <div className="px-4 pt-4 md:px-6 md:pt-6">
            <SyncConflictBanner />
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
