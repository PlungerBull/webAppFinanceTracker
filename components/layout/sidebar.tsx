'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { AddAccountModal } from '@/features/accounts/components/add-account-modal';
import { EditAccountModal } from '@/features/accounts/components/edit-account-modal';
import { DeleteAccountDialog } from '@/features/accounts/components/delete-account-dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel, // Keep this import, it's still part of the component file
} from '@/components/ui/dropdown-menu';
import {
  Home,
  Wallet,
  Settings,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  ChevronDown,
  MoreHorizontal,
  Edit,
  Crown,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';
import { getInitials } from '@/lib/utils'; // <-- IMPORT THE HELPER

type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { data: accounts = [], isLoading } = useAccounts();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(true);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);
  const [hoveredAccountId, setHoveredAccountId] = useState<string | null>(null);
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

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  // Group account balances by account_id
  const groupedAccounts = useMemo(() => {
    const grouped = new Map<string, typeof accounts>();
    accounts.forEach((balance) => {
      // Filter out balances without account_id
      if (!balance.account_id) return;

      const existing = grouped.get(balance.account_id) || [];
      grouped.set(balance.account_id, [...existing, balance]);
    });
    return Array.from(grouped.entries()).map(([account_id, balances]) => ({
      account_id,
      name: balances[0].name ?? 'Unknown Account',
      balances: balances.sort((a, b) =>
        (a.currency ?? '').localeCompare(b.currency ?? '')
      ),
    }));
  }, [accounts]);

  const renderUserAvatar = () => (
    <div
      className={cn(
        'flex-shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium',
        !isCollapsed && 'mr-2',
        isCollapsed ? 'h-6 w-6 text-sm' : 'h-5 w-5 text-xs' // Different sizes for collapsed/expanded
      )}
    >
      {initials}
    </div>
  );

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Header - User Menu */}
      <div
        className={cn(
          'flex items-center p-4 border-b border-zinc-200 dark:border-zinc-800',
          isCollapsed && 'p-2 justify-center' // Center icons when collapsed
        )}
      >
        {!isClient ? (
          // Render a static placeholder on the server to prevent layout shift
          <Button
            variant="ghost"
            className={cn(
              'justify-start text-left h-auto',
              isCollapsed
                ? 'w-full justify-center p-2'
                : 'flex-1 min-w-0 px-2 py-1.5'
            )}
            disabled={true}
          >
            <div className="flex items-center min-w-0">
              <User
                className={cn(
                  'h-5 w-5 flex-shrink-0',
                  !isCollapsed && 'mr-2'
                )}
              />
              {!isCollapsed && (
                <span className="truncate text-sm font-medium text-zinc-400">
                  Loading...
                </span>
              )}
            </div>
          </Button>
        ) : (
          // This part now *only* renders on the client, fixing the error
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'justify-start text-left h-auto',
                  isCollapsed
                    ? 'w-full justify-center p-2'
                    : 'flex-1 min-w-0 px-2 py-1.5'
                )}
              >
                <div className="flex items-center min-w-0">
                  {renderUserAvatar()}
                  {!isCollapsed && (
                    <span className="truncate text-sm font-medium">
                      {userDisplayName}
                    </span>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isCollapsed ? 'end' : 'start'}
              className="w-56"
            >
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
        )}

        {/* Collapse/Expand Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(isCollapsed ? 'hidden' : 'block')} // Sits next to the user menu
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(isCollapsed ? 'block' : 'hidden')} // Centered with user icon
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {/* Main Navigation */}
        <div className="space-y-1 mb-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start',
                    isCollapsed && 'justify-center px-2'
                  )}
                >
                  <Icon className={cn('h-5 w-5', !isCollapsed && 'mr-2')} />
                  {!isCollapsed && <span>{item.label}</span>}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Accounts Section */}
        {!isCollapsed && (
          <div className="mb-4">
            <div className="px-2 mb-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                <button
                  onClick={() => router.push('/transactions')}
                  className="flex-1 text-left px-2 py-1 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  All Accounts
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsAddAccountModalOpen(true)}
                    title="Add Account"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsAccountsExpanded(!isAccountsExpanded)}
                  >
                    {isAccountsExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {isAccountsExpanded && (
              <div className="space-y-1">
                {isLoading ? (
                  <div className="px-2 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    Loading...
                  </div>
                ) : groupedAccounts.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No accounts yet!
                  </div>
                ) : (
                  groupedAccounts.map((account) => (
                    <div
                      key={account.account_id}
                      className="relative group px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer"
                      onClick={() =>
                        router.push(`/accounts/${account.account_id}`)
                      }
                    >
                      {/* Account Header with Icon and Name */}
                      <div className="flex items-center w-full text-sm">
                        <Wallet className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate flex-1">{account.name}</span>
                        <div className="opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity ml-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-xs text-zinc-500 dark:text-zinc-400 border-0 bg-transparent flex items-center justify-center outline-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="z-50"
                            >
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const balance = account.balances[0];
                                  if (
                                    balance.account_id &&
                                    balance.user_id &&
                                    balance.created_at &&
                                    balance.updated_at
                                  ) {
                                    const bankAccount: BankAccount = {
                                      id: balance.account_id,
                                      user_id: balance.user_id,
                                      name:
                                        balance.name ?? 'Unknown Account',
                                      created_at: balance.created_at,
                                      updated_at: balance.updated_at,
                                    };
                                    setEditingAccount(bankAccount);
                                  }
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const balance = account.balances[0];
                                  if (
                                    balance.account_id &&
                                    balance.user_id &&
                                    balance.created_at &&
                                    balance.updated_at
                                  ) {
                                    const bankAccount: BankAccount = {
                                      id: balance.account_id,
                                      user_id: balance.user_id,
                                      name:
                                        balance.name ?? 'Unknown Account',
                                      created_at: balance.created_at,
                                      updated_at: balance.updated_at,
                                    };
                                    setDeletingAccount(bankAccount);
                                  }
                                }}
                                className="text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Currency Balances - Indented */}
                      <div className="ml-6 space-y-0.5">
                        {account.balances.map((balance) => (
                          <div
                            key={balance.id ?? Math.random()}
                            className="flex items-center justify-between text-xs py-0.5 px-2"
                          >
                            <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                              {balance.currency ?? 'N/A'}
                            </span>
                            <span
                              className={cn(
                                'font-medium tabular-nums',
                                (balance.current_balance ?? 0) >= 0
                                  ? 'text-zinc-700 dark:text-zinc-300'
                                  : 'text-red-600 dark:text-red-400'
                              )}
                            >
                              {formatCurrency(
                                balance.current_balance ?? 0,
                                balance.currency ?? 'USD'
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsed Accounts */}
        {isCollapsed && (
          <div className="mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="w-full"
              onClick={() => setIsCollapsed(false)}
            >
              <Wallet className="h-5 w-5" />
            </Button>
          </div>
        )}
      </nav>

      {/* Add Account Modal */}
      <AddAccountModal
        open={isAddAccountModalOpen}
        onOpenChange={setIsAddAccountModalOpen}
      />

      {/* Edit Account Modal */}
      <EditAccountModal
        open={!!editingAccount}
        onOpenChange={(open) => !open && setEditingAccount(null)}
        account={editingAccount}
      />

      {/* Delete Account Dialog */}
      <DeleteAccountDialog
        open={!!deletingAccount}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        account={deletingAccount}
      />
    </aside>
  );
}