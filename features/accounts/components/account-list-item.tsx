'use client';

import { Pencil, Trash2, CreditCard } from 'lucide-react';
import { ResourceListItem } from '@/components/ui/resource-list-item';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { ACCOUNT, ACCOUNT_UI } from '@/lib/constants';
import type { GroupedAccount } from '@/hooks/use-grouped-accounts';
import type { BankAccount } from '@/types/domain';

interface AccountListItemProps {
    account: GroupedAccount;
    isActive: boolean;
    onClick: () => void;
    onEdit: (account: BankAccount) => void;
    onDelete: (account: BankAccount) => void;
}

export function AccountListItem({
    account,
    isActive,
    onClick,
    onEdit,
    onDelete,
}: AccountListItemProps) {
    // Helper to construct BankAccount from GroupedAccount data
    // Using the first balance's accountId to represent the group
    const getBankAccount = (): BankAccount | null => {
        const firstBalance = account.balances[0];
        if (!firstBalance?.accountId) return null;

        // TODO: This is a temporary solution. Edit modal needs rewrite for container pattern.
        // Currently using the first balance's accountId to represent a specific currency account
        return {
            id: firstBalance.accountId, // Use specific currency account ID
            groupId: account.groupId,
            name: account.name,
            color: account.color,
            currencyCode: firstBalance.currency,
            type: account.type,
            userId: '', // Not available in GroupedAccount - will be fetched by modal if needed
            isVisible: true, // Not available in GroupedAccount
            createdAt: new Date().toISOString(), // Not available
            updatedAt: new Date().toISOString(), // Not available
        };
    };

    const actions = [
        {
            label: ACCOUNT_UI.LABELS.EDIT_ACCOUNT,
            icon: Pencil,
            onClick: () => {
                const bankAccount = getBankAccount();
                if (bankAccount) onEdit(bankAccount);
            },
        },
        {
            label: ACCOUNT_UI.LABELS.DELETE_ACCOUNT,
            icon: Trash2,
            onClick: () => {
                const bankAccount = getBankAccount();
                if (bankAccount) onDelete(bankAccount);
            },
            className: 'text-red-600',
        },
    ];

    return (
        <ResourceListItem
            icon={CreditCard}
            iconColor={account.color}
            title={account.name}
            isActive={isActive}
            onClick={onClick}
            actions={actions}
        >
            {/* Currency Balances - Indented */}
            <div className="ml-8 space-y-0.5">
                {account.balances.map((balance) => (
                    <div
                        key={balance.currency}
                        className="flex items-center justify-between text-xs py-0.5 px-2"
                    >
                        <span className="text-gray-500 font-medium">
                            {balance.currency}
                        </span>
                        <span
                            className={cn(
                                'font-mono tabular-nums',
                                balance.amount >= 0
                                    ? 'text-gray-500'
                                    : 'text-red-600'
                            )}
                        >
                            {formatCurrency(balance.amount, balance.currency)}
                        </span>
                    </div>
                ))}
            </div>
        </ResourceListItem>
    );
}
