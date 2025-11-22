'use client';

import {
    MoreHorizontal,
    Pencil,
    Trash2,
    DollarSign,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { ACCOUNT, ACCOUNT_UI } from '@/lib/constants';
import type { GroupedAccount } from '@/hooks/use-grouped-accounts';
import type { Database } from '@/types/database.types';

type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];

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
    return (
        <div
            className={cn(
                "relative group px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer",
                isActive && "bg-zinc-100 dark:bg-zinc-800"
            )}
            onClick={onClick}
        >
            {/* Account Header with Icon and Name */}
            <div className="flex items-center w-full text-sm">
                <DollarSign
                    className="h-4 w-4 mr-2 flex-shrink-0"
                    style={{ color: account.color }}
                />
                <span className="truncate flex-1">{account.name}</span>
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity ml-2">
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
                                    const balance = account.balances[0];
                                    // Construct a BankAccount object from the balance view data
                                    // This assumes the view contains all necessary fields or we provide defaults
                                    if (balance.account_id && balance.user_id) {
                                        const bankAccount: BankAccount = {
                                            id: balance.account_id,
                                            user_id: balance.user_id,
                                            name: balance.name ?? ACCOUNT_UI.LABELS.UNKNOWN_ACCOUNT,
                                            color: balance.color ?? ACCOUNT.DEFAULT_COLOR,
                                            created_at: balance.created_at ?? new Date().toISOString(), // These might be missing from view, using fallback
                                            updated_at: balance.updated_at ?? new Date().toISOString(),
                                        };
                                        onEdit(bankAccount);
                                    }
                                }}
                            >
                                <Pencil className="mr-2 h-4 w-4" />
                                {ACCOUNT_UI.LABELS.EDIT_ACCOUNT}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-red-600"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const balance = account.balances[0];
                                    if (balance.account_id && balance.user_id) {
                                        const bankAccount: BankAccount = {
                                            id: balance.account_id,
                                            user_id: balance.user_id,
                                            name: balance.name ?? ACCOUNT_UI.LABELS.UNKNOWN_ACCOUNT,
                                            color: balance.color ?? ACCOUNT.DEFAULT_COLOR,
                                            created_at: balance.created_at ?? new Date().toISOString(),
                                            updated_at: balance.updated_at ?? new Date().toISOString(),
                                        };
                                        onDelete(bankAccount);
                                    }
                                }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {ACCOUNT_UI.LABELS.DELETE_ACCOUNT}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Currency Balances - Indented */}
            <div className="ml-6 space-y-0.5">
                {account.balances.map((balance) => (
                    <div
                        key={balance.currency ?? 'unknown'}
                        className="flex items-center justify-between text-xs py-0.5 px-2"
                    >
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                            {balance.currency ?? ACCOUNT_UI.LABELS.NOT_AVAILABLE}
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
    );
}
