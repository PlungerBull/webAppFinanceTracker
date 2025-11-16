'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Wallet,
  Plus,
  ChevronDown,
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];

export function AccountList() {
  const router = useRouter();
  const { data: accounts = [], isLoading } = useAccounts();
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(true);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);

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

  return (
    <>
      <div className="mb-4">
        <div className="px-2 mb-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
            <span className="flex-1 text-left px-2 py-1 text-zinc-500 dark:text-zinc-400">
              Accounts
            </span>
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
                    router.push(`/transactions?account=${account.account_id}`)
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

      {/* Modals */}
      <AddAccountModal
        open={isAddAccountModalOpen}
        onOpenChange={setIsAddAccountModalOpen}
      />

      <EditAccountModal
        open={!!editingAccount}
        onOpenChange={(open) => !open && setEditingAccount(null)}
        account={editingAccount}
      />

      <DeleteAccountDialog
        open={!!deletingAccount}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        account={deletingAccount}
      />
    </>
  );
}
