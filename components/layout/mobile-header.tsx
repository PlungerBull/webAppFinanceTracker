'use client';

import { Menu, Cloud, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/contexts/sidebar-context';
import { useSyncExternalStore } from 'react';

/**
 * Hook to detect online/offline status
 * Uses useSyncExternalStore for proper React 18+ synchronization
 */
function useOnlineStatus() {
  const getSnapshot = () => navigator.onLine;
  const getServerSnapshot = () => true; // Assume online during SSR

  const subscribe = (callback: () => void) => {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    return () => {
      window.removeEventListener('online', callback);
      window.removeEventListener('offline', callback);
    };
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * MobileHeader - Sticky header for mobile viewports
 * Includes hamburger menu and sync/network status indicator
 */
export function MobileHeader() {
  const { openMobile } = useSidebar();
  const isOnline = useOnlineStatus();

  return (
    <header
      className="md:hidden sticky top-0 flex items-center justify-between h-14 px-4 border-b border-gray-200 bg-white"
      style={{ zIndex: 'var(--z-header)' }}
    >
      {/* Hamburger Menu Button - 44x44px touch target */}
      <Button
        variant="ghost"
        size="icon"
        onClick={openMobile}
        className="h-11 w-11 -ml-2"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* App Title */}
      <span className="font-semibold text-gray-900">Finance Tracker</span>

      {/* Sync/Network Status Indicator */}
      <div className="h-11 w-11 flex items-center justify-center -mr-2">
        {isOnline ? (
          <Cloud className="h-5 w-5 text-green-500" aria-label="Online" />
        ) : (
          <div className="flex items-center gap-1">
            <CloudOff className="h-5 w-5 text-amber-500" aria-label="Offline" />
          </div>
        )}
      </div>
    </header>
  );
}
