'use client';

import { useState } from 'react';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
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

export function AccountList() {
  const { groupedAccounts, isLoading } = useGroupedAccounts();
  const { handleAccountClick, currentAccountId } = useAccountNavigation();
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(true);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

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
          <div className="space-y-1">
            {isLoading ? (
              <div className="px-2 py-4 text-center text-sm text-gray-400">
                {ACCOUNT_UI.MESSAGES.LOADING}
              </div>
            ) : groupedAccounts.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-gray-400">
                {ACCOUNT_UI.MESSAGES.NO_ACCOUNTS}
              </div>
            ) : (
              groupedAccounts
                .map((account) => (
                  <AccountListItem
                    key={account.groupId}
                    account={account}
                    isActive={currentAccountId === account.groupId}
                    onClick={() => handleAccountClick(account.groupId)}
                    onEdit={setEditingAccount}
                    onDelete={setDeletingAccount}
                  />
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
