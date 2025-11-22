'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
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

interface UserMenuProps {
  isCollapsed: boolean;
  className?: string;
}

export function UserMenu({ isCollapsed, className }: UserMenuProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const userDisplayName = useMemo(() => {
    if (!user) return 'User';
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    return user.email || 'User';
  }, [user]);

  const initials = useMemo(() => {
    if (!user) return '?';
    const firstName = user.user_metadata?.firstName;
    const lastName = user.user_metadata?.lastName;

    if (firstName || lastName) {
      return getInitials(firstName, lastName);
    }
    // Fallback if no name is set
    return getInitials(user.email);
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
        'flex-shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium',
        !isCollapsed && 'mr-2',
        isCollapsed ? 'h-6 w-6 text-sm' : 'h-5 w-5 text-xs'
      )}
    >
      {initials}
    </div>
  );

  if (!isClient) {
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
          <span className="truncate text-sm font-medium text-zinc-400">
            Loading...
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
            <span className="truncate text-sm font-medium">
              {userDisplayName}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Crown className="mr-2 h-4 w-4" />
          Premium
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
