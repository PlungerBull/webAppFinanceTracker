'use client';

import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/sidebar-context';
import { useIsMobile } from '@/lib/hooks/use-is-mobile';
import { SidebarContent } from '@/components/layout/sidebar-content';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { isCollapsed, toggleSidebar, isMobileOpen, closeMobile } = useSidebar();
  const isMobile = useIsMobile();

  // Mobile: Render as Sheet drawer
  if (isMobile) {
    return (
      <Sheet open={isMobileOpen} onOpenChange={(open) => !open && closeMobile()}>
        <SheetContent side="left" className="w-72 p-0" style={{ zIndex: 'var(--z-drawer)' }}>
          <div className="flex flex-col h-dvh bg-white">
            <SidebarContent onCloseMobile={closeMobile} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Render as aside with collapse toggle
  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-dvh bg-white border-r border-gray-200 transition-all duration-300 relative',
        isCollapsed ? 'w-0' : 'w-72',
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
          isCollapsed ? 'left-3' : 'left-[250px]'
        )}
      >
        {isCollapsed ? (
          <PanelLeft className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
      </Button>

      {/* Sidebar Content - Hidden when collapsed */}
      {!isCollapsed && <SidebarContent isCollapsed={isCollapsed} />}
    </aside>
  );
}
