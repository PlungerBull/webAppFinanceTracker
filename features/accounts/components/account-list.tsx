'use client';

import { useState } from 'react';
import { useFlatAccounts, type FlatAccount } from '@/lib/hooks/use-flat-accounts';
import { useAccountNavigation } from '@/lib/hooks/use-account-navigation';
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

export function AccountList() {
  const { flatAccounts, isLoading } = useFlatAccounts();
  const { handleAccountClick, currentAccountId } = useAccountNavigation();
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(true);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  // Use FlatAccount (AccountViewEntity) for editing/deleting state
  const [editingAccount, setEditingAccount] = useState<FlatAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<FlatAccount | null>(null);

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
              <div className="space-y-0.5">
                {flatAccounts.map(account => (
                  <AccountListItem
                    key={account.id}
                    account={account}
                    isActive={currentAccountId === account.id}
                    onClick={() => handleAccountClick(account.id)}
                    onEdit={setEditingAccount}
                    onDelete={setDeletingAccount}
                  />
                ))}
              </div>
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
