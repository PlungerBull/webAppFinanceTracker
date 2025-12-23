'use client';

import { useState, useMemo } from 'react';
import { useFlatAccounts } from '@/hooks/use-flat-accounts';
import { useAccountNavigation } from '@/hooks/use-account-navigation';
import { AddAccountModal } from '@/features/accounts/components/add-account-modal';
import { EditAccountModal } from '@/features/accounts/components/edit-account-modal';
import { DeleteAccountDialog } from '@/features/accounts/components/delete-account-dialog';
import { Button } from '@/components/ui/button';
import { AccountListItem } from './account-list-item';
import {
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ACCOUNT_UI } from '@/lib/constants';
import type { Account } from '@/types/domain';

const TYPE_ORDER = ['checking', 'savings', 'credit_card', 'investment', 'loan', 'cash', 'other'] as const;

const TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Cards',
  investment: 'Investments',
  loan: 'Loans',
  cash: 'Cash',
  other: 'Other',
};

export function AccountList() {
  const { flatAccounts, isLoading } = useFlatAccounts();
  const { handleAccountClick, currentAccountId } = useAccountNavigation();
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(true);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

  // Group accounts by type
  const accountsByType = useMemo(() => {
    const grouped = new Map<string, typeof flatAccounts>();

    flatAccounts.forEach(account => {
      const type = account.type ?? 'other';
      const existing = grouped.get(type) || [];
      grouped.set(type, [...existing, account]);
    });

    return grouped;
  }, [flatAccounts]);

  return (
    <>
      <div className="mb-4">
        <div className="px-3 mb-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
            <span className="flex-1 text-left px-2 py-1 text-gray-400">
              {ACCOUNT_UI.LABELS.ACCOUNTS}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsAddAccountModalOpen(true)}
                title={ACCOUNT_UI.LABELS.ADD_ACCOUNT}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsAccountsExpanded(!isAccountsExpanded)}
              >
                {isAccountsExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {isAccountsExpanded && (
          <>
            {isLoading ? (
              <div className="px-2 py-4 text-center text-sm text-gray-400">
                {ACCOUNT_UI.MESSAGES.LOADING}
              </div>
            ) : flatAccounts.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-gray-400">
                {ACCOUNT_UI.MESSAGES.NO_ACCOUNTS}
              </div>
            ) : (
              TYPE_ORDER.map(type => {
                const accounts = accountsByType.get(type);
                if (!accounts || accounts.length === 0) return null;

                return (
                  <div key={type} className="mb-3">
                    {/* Section Header */}
                    <div className="text-[9px] uppercase font-bold tracking-[0.12em] text-gray-400 px-2 py-2">
                      {TYPE_LABELS[type]}
                    </div>

                    {/* Account Items */}
                    <div className="space-y-0.5">
                      {accounts.map(account => (
                        <AccountListItem
                          key={account.accountId}
                          account={account}
                          isActive={currentAccountId === account.accountId}
                          onClick={() => handleAccountClick(account.accountId!)}
                          onEdit={setEditingAccount}
                          onDelete={setDeletingAccount}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </>
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
