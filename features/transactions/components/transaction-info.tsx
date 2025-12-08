'use client';

import { useMemo } from 'react';

import { format } from 'date-fns';
import { Calendar, Check, X, Hash } from 'lucide-react';
import { TRANSACTIONS, CURRENCY, UI } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import type { EditingField, TransactionValue } from '@/hooks/use-transaction-editor';
import type { TransactionRow, Category, Account } from '../types';

interface TransactionInfoProps {
    transaction: TransactionRow;
    categories: Category[];
    accounts: Account[];
    editingField: EditingField | null;
    editedValue: TransactionValue;
    showDatePicker: boolean;
    setEditedValue: (value: TransactionValue) => void;
    setShowDatePicker: (show: boolean) => void;
    startEdit: (field: EditingField, value: TransactionValue) => void;
    cancelEdit: () => void;
    saveEdit: (id: string, field: string, value: TransactionValue) => Promise<void>;
}

export function TransactionInfo({
    transaction,
    categories,
    accounts,
    editingField,
    editedValue,
    showDatePicker,
    setEditedValue,
    setShowDatePicker,
    startEdit,
    cancelEdit,
    saveEdit,
}: TransactionInfoProps) {
    const categoryGroups = useMemo(() => {
        const groups: { parent: Category; children: Category[] }[] = [];
        const parents = categories.filter(c => c.parentId === null);
        const childrenMap = new Map<string, Category[]>();

        categories.filter(c => c.parentId !== null).forEach(child => {
            if (child.parentId) {
                const list = childrenMap.get(child.parentId) || [];
                list.push(child);
                childrenMap.set(child.parentId, list);
            }
        });

        parents.forEach(parent => {
            const children = childrenMap.get(parent.id);
            if (children && children.length > 0) {
                groups.push({ parent, children });
            }
        });

        return groups.sort((a, b) => (a.parent.name || '').localeCompare(b.parent.name || ''));
    }, [categories]);

    return (
        <div className="space-y-4">
            {/* Date */}
            <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    {TRANSACTIONS.UI.LABELS.DATE}
                </p>
                {editingField === 'date' ? (
                    <div className="flex items-center gap-2">
                        <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal flex-1"
                                >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    {editedValue && typeof editedValue === 'string' ? (() => {
                                        try {
                                            const cleanDate = editedValue.substring(0, 10);
                                            const date = new Date(cleanDate + 'T00:00:00');
                                            return !isNaN(date.getTime()) ? format(date, 'PPP') : editedValue;
                                        } catch { return editedValue; }
                                    })() : <span>{TRANSACTIONS.UI.LABELS.PICK_DATE}</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                    mode="single"
                                    selected={(() => {
                                        if (!editedValue || typeof editedValue !== 'string') return undefined;
                                        const cleanDate = editedValue.substring(0, 10);
                                        const date = new Date(cleanDate + 'T00:00:00');
                                        return !isNaN(date.getTime()) ? date : undefined;
                                    })()}
                                    onSelect={(date) => {
                                        if (date) {
                                            setEditedValue(format(date, 'yyyy-MM-dd'));
                                            setShowDatePicker(false);
                                        }
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            onClick={() => saveEdit(transaction.id, 'date', editedValue)}
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
                        className="text-sm text-zinc-900 dark:text-zinc-50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1 -mx-2 rounded"
                        onClick={() => startEdit('date', transaction.date)}
                    >
                        {(() => {
                            if (!transaction.date) return 'No date';
                            try {
                                const cleanDate = transaction.date.substring(0, 10);
                                const date = new Date(cleanDate + 'T00:00:00');
                                return !isNaN(date.getTime()) ? format(date, 'MMMM dd, yyyy') : transaction.date;
                            } catch { return transaction.date; }
                        })()}
                    </p>
                )}
            </div>

            {/* Category */}
            <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    {TRANSACTIONS.UI.LABELS.CATEGORY}
                </p>
                {editingField === 'category_id' ? (
                    <div className="flex items-center gap-2">
                        <Select
                            value={String(editedValue || '')}
                            onValueChange={(value) => setEditedValue(value)}
                        >
                            <SelectTrigger className="flex-1">
                                <SelectValue placeholder={TRANSACTIONS.UI.LABELS.SELECT_CATEGORY} />
                            </SelectTrigger>
                            <SelectContent>
                                {categoryGroups.map((group) => (
                                    <SelectGroup key={group.parent.id}>
                                        <SelectLabel>{group.parent.name}</SelectLabel>
                                        {group.children.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 shrink-0"
                                                        style={{ color: category.color }}
                                                    >
                                                        <Hash className="w-3 h-3" />
                                                    </div>
                                                    <span>{category.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            onClick={() => saveEdit(transaction.id, 'category_id', editedValue || null)}
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
                    <div
                        className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1 -mx-2 rounded"
                        onClick={() => startEdit('category_id', transaction.categoryId)}
                    >
                        {transaction.categoryName ? (
                            <div className="flex items-center gap-2">
                                <div
                                    className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 shrink-0"
                                    style={{ color: transaction.categoryColor || undefined }}
                                >
                                    <Hash className="w-3 h-3" />
                                </div>
                                <span className="text-sm text-zinc-900 dark:text-zinc-50">
                                    {transaction.categoryName}
                                </span>
                            </div>
                        ) : (
                            <p className="text-sm text-zinc-400 dark:text-zinc-500">{TRANSACTIONS.UI.LABELS.UNCATEGORIZED}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Bank Account */}
            <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    {TRANSACTIONS.UI.LABELS.BANK_ACCOUNT}
                </p>
                {editingField === 'account_id' ? (
                    <div className="flex items-center gap-2">
                        <Select
                            value={String(editedValue || '')}
                            onValueChange={(value) => setEditedValue(value)}
                        >
                            <SelectTrigger className="flex-1">
                                <SelectValue placeholder={TRANSACTIONS.UI.LABELS.SELECT_ACCOUNT} />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                        {account.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            onClick={() => saveEdit(transaction.id, 'account_id', editedValue || null)}
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
                        className="text-sm text-zinc-900 dark:text-zinc-50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1 -mx-2 rounded"
                        onClick={() => startEdit('account_id', transaction.accountId)}
                    >
                        {transaction.accountName}
                    </p>
                )}
            </div>

            {/* Exchange Rate - Only show if not 1 */}
            {transaction.exchangeRate && transaction.exchangeRate !== 1 && (
                <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                        {TRANSACTIONS.UI.LABELS.EXCHANGE_RATE}
                    </p>
                    <p className="text-sm text-zinc-900 dark:text-zinc-50">
                        {transaction.exchangeRate.toFixed(CURRENCY.FORMAT.EXCHANGE_RATE_PRECISION)}
                    </p>
                </div>
            )}

            {/* Notes - Always show */}
            <div className="group">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    {TRANSACTIONS.UI.LABELS.NOTES}
                </p>
                {editingField === 'notes' ? (
                    <div className="flex items-start gap-2">
                        <Textarea
                            value={editedValue || ''}
                            onChange={(e) => setEditedValue(e.target.value)}
                            placeholder={TRANSACTIONS.UI.LABELS.ADD_NOTE_PLACEHOLDER}
                            className="resize-none text-sm flex-1"
                            rows={UI.ROWS.NOTES_EXPANDED}
                            autoFocus
                        />
                        <div className="flex flex-col gap-1">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/20"
                                onClick={() => saveEdit(transaction.id, 'notes', editedValue)}
                            >
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                                onClick={cancelEdit}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-zinc-900 dark:text-zinc-50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1 -mx-2 rounded min-h-[60px]"
                        onClick={() => startEdit('notes', transaction.notes)}>
                        {transaction.notes || TRANSACTIONS.UI.MESSAGES.NO_NOTES}
                    </p>
                )}
            </div>
        </div>
    );
}
