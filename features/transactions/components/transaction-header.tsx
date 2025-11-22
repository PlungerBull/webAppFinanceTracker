'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRANSACTIONS } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import type { EditingField } from '@/hooks/use-transaction-editor';

// Define the interface locally since it's not exported from a shared type file yet
// Ideally this should come from types/database.types or similar
interface TransactionRow {
    id: string;
    date: string;
    description: string;
    category_name: string | null;
    category_color: string | null;
    category_id: string | null;
    amount_original: number;
    currency_original: string;
    account_name: string;
    account_id: string;
    exchange_rate: number | null;
    notes: string | null;
}

interface TransactionHeaderProps {
    transaction: TransactionRow;
    editingField: EditingField | null;
    editedValue: any;
    setEditedValue: (value: any) => void;
    startEdit: (field: EditingField, value: any) => void;
    cancelEdit: () => void;
    saveEdit: (id: string, field: string, value: any) => Promise<void>;
}

export function TransactionHeader({
    transaction,
    editingField,
    editedValue,
    setEditedValue,
    startEdit,
    cancelEdit,
    saveEdit,
}: TransactionHeaderProps) {
    return (
        <div className="mb-6">
            {/* Description */}
            <div className="mb-2 group">
                {editingField === 'description' ? (
                    <div className="flex items-center gap-2">
                        <Input
                            value={editedValue || ''}
                            onChange={(e) => setEditedValue(e.target.value)}
                            className="text-lg font-semibold flex-1"
                            placeholder={TRANSACTIONS.UI.PLACEHOLDERS.DESCRIPTION}
                            autoFocus
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            onClick={() => saveEdit(transaction.id, 'description', editedValue)}
                        >
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600"
                            onClick={cancelEdit}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <h2
                        className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1 -mx-2 rounded"
                        onClick={() => startEdit('description', transaction.description)}
                    >
                        {transaction.description}
                    </h2>
                )}
            </div>

            {/* Amount */}
            <div className="group">
                {editingField === 'amount' ? (
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            value={editedValue || 0}
                            onChange={(e) => setEditedValue(parseFloat(e.target.value))}
                            className="text-2xl font-bold flex-1"
                            placeholder={TRANSACTIONS.UI.PLACEHOLDERS.AMOUNT_INPUT}
                            autoFocus
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            onClick={() => saveEdit(transaction.id, 'amount_original', editedValue)}
                        >
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600"
                            onClick={cancelEdit}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <p
                        className={cn(
                            'text-2xl font-bold tabular-nums cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1 -mx-2 rounded',
                            transaction.amount_original >= 0
                                ? 'text-green-600 dark:text-green-500'
                                : 'text-red-600 dark:text-red-500'
                        )}
                        onClick={() => startEdit('amount', transaction.amount_original)}
                    >
                        {formatCurrency(transaction.amount_original, transaction.currency_original)}
                    </p>
                )}
            </div>
        </div>
    );
}
