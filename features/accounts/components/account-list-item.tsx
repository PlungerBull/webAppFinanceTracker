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
    // Helper to construct BankAccount from balance view data
    const getBankAccount = (): BankAccount | null => {
        const balance = account.balances[0];
        if (!balance.account_id || !balance.user_id) return null;

        return {
            id: balance.account_id,
            user_id: balance.user_id,
            name: balance.name ?? ACCOUNT_UI.LABELS.UNKNOWN_ACCOUNT,
            color: balance.color ?? ACCOUNT.DEFAULT_COLOR,
            is_visible: balance.is_visible ?? true,
            created_at: balance.created_at ?? new Date().toISOString(),
            updated_at: balance.updated_at ?? new Date().toISOString(),
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
            iconColor={account.balances[0]?.color || ACCOUNT.DEFAULT_COLOR}
            title={account.name}
            isActive={isActive}
            onClick={onClick}
            actions={actions}
        >
            {/* Currency Balances - Indented */}
            <div className="ml-8 space-y-0.5">
                {account.balances.map((balance) => (
                    <div
                        key={balance.currency ?? 'unknown'}
                        className="flex items-center justify-between text-xs py-0.5 px-2"
                    >
                        <span className="text-gray-500 font-medium">
                            {balance.currency ?? ACCOUNT_UI.LABELS.NOT_AVAILABLE}
                        </span>
                        <span
                            className={cn(
                                'font-mono tabular-nums',
                                (balance.current_balance ?? 0) >= 0
                                    ? 'text-gray-500'
                                    : 'text-red-600'
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
        </ResourceListItem>
    );
}
