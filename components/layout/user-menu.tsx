'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useIsMounted } from '@/lib/hooks/use-is-mounted';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, User, LogOut, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';
import { USER_MENU } from '@/lib/constants';
import { getDisplayName } from '@/domain/auth';

interface UserMenuProps {
  isCollapsed: boolean;
  className?: string;
}

export function UserMenu({ isCollapsed, className }: UserMenuProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  // CTO Standard: Use useSyncExternalStore-based hook for hydration-safe client detection
  // This avoids the react-hooks/set-state-in-effect lint error
  const isMounted = useIsMounted();

  const userDisplayName = useMemo(() => {
    if (!user) return USER_MENU.DEFAULT_NAME;
    // Use platform-agnostic getDisplayName helper
    return getDisplayName(user);
  }, [user]);

  const initials = useMemo(() => {
    if (!user) return USER_MENU.FALLBACK_INITIALS;
    // AuthUserEntity has firstName/lastName directly (not in user_metadata)
    if (user.firstName || user.lastName) {
      return getInitials(user.firstName ?? undefined, user.lastName ?? undefined);
    }
    // Fallback if no name is set
    return getInitials(user.email ?? undefined);
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const renderUserAvatar = () => (
    <div
      className={cn(
        'flex-shrink-0 rounded-full bg-slate-800 text-white flex items-center justify-center font-medium',
        !isCollapsed && 'mr-2',
        'h-6 w-6 text-xs'
      )}
    >
      {initials}
    </div>
  );

  if (!isMounted) {
    // Render a static placeholder on the server to prevent layout shift
    return (
      <Button
        variant="ghost"
        className={cn(
          "flex-1 min-w-0 px-2 py-1.5 justify-start text-left h-auto",
          className
        )}
        disabled={true}
      >
        <div className="flex items-center min-w-0">
          <User className="h-5 w-5 flex-shrink-0 mr-2" />
          <span className="truncate text-sm font-medium text-gray-400">
            {USER_MENU.LOADING}
          </span>
        </div>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex-1 min-w-0 px-2 py-1.5 justify-start text-left h-auto",
            className
          )}
        >
          <div className="flex items-center min-w-0">
            {renderUserAvatar()}
            <span className="truncate text-sm font-medium text-gray-900">
              {userDisplayName}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          {USER_MENU.LABELS.SETTINGS}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Crown className="mr-2 h-4 w-4" />
          {USER_MENU.LABELS.PREMIUM}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {USER_MENU.LABELS.LOGOUT}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
