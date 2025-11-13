'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { AddAccountModal } from '@/features/accounts/components/add-account-modal';
import { EditAccountModal } from '@/features/accounts/components/edit-account-modal';
import { DeleteAccountDialog } from '@/features/accounts/components/delete-account-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  ChevronUp,
  Lock,
  Trash2,
  MoreHorizontal,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

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
  const [isUserMenuExpanded, setIsUserMenuExpanded] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);
  const [hoveredAccountId, setHoveredAccountId] = useState<string | null>(null);

  // TODO: Fetch user nickname from database
  const userDisplayName = user?.email || 'User';

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        {!isCollapsed && (
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Finance Tracker
          </h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
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
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                <span>Accounts</span>
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
                      <ChevronLeft className="h-3 w-3" />
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
                ) : accounts.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No accounts yet!
                  </div>
                ) : (
                  accounts.map((account) => (
                    <div
                      key={account.id}
                      className="relative group"
                    >
                      <div className="flex items-center justify-between w-full px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-sm">
                        <div
                          className="flex items-center min-w-0 flex-1 cursor-pointer"
                          onClick={() => router.push(`/accounts/${account.id}`)}
                        >
                          <Wallet className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="truncate">{account.name}</span>
                        </div>
                        <div className="flex items-center ml-2 flex-shrink-0 relative min-w-[80px] justify-end">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 absolute right-0 group-hover:opacity-0 group-hover:pointer-events-none transition-opacity">
                            {formatCurrency(account.current_balance || account.starting_balance, account.currency)}
                          </span>
                          <div className="opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-xs text-zinc-500 dark:text-zinc-400 border-0 bg-transparent flex items-center justify-center outline-none"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-50">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingAccount(account);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingAccount(account);
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

      {/* User Section */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-2">
        {!isCollapsed ? (
          <div>
            <Button
              variant="ghost"
              className="w-full justify-between"
              onClick={() => setIsUserMenuExpanded(!isUserMenuExpanded)}
            >
              <div className="flex items-center min-w-0">
                <User className="h-5 w-5 mr-2 flex-shrink-0" />
                <span className="truncate text-sm">{userDisplayName}</span>
              </div>
              {isUserMenuExpanded ? (
                <ChevronUp className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              )}
            </Button>

            {isUserMenuExpanded && (
              <div className="space-y-1 mt-1 pl-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => router.push('/profile')}
                >
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => router.push('/change-password')}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm text-red-600 dark:text-red-400"
                  onClick={() => router.push('/delete-account')}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-full"
              onClick={() => setIsCollapsed(false)}
            >
              <User className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

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
