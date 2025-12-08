'use client';

import { useMemo } from 'react';

import { format } from 'date-fns';
import { Calendar, Hash, CreditCard, FileText, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { useTransactionEditor } from '@/hooks/use-transaction-editor';
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
import type { TransactionRow } from '../types';
import type { CategoryWithCount } from '@/types/domain';

interface TransactionDetailPanelProps {
  transaction: TransactionRow | null;
  accountId: string | null;
  categories: CategoryWithCount[];
  accounts: { id: string; name: string }[];
}

export function TransactionDetailPanel({
  transaction,
  accountId,
  categories,
  accounts,
}: TransactionDetailPanelProps) {
  // Dependencies received as props

  const {
    editingField,
    editedValue,
    showDatePicker,
    setEditedValue,
    setShowDatePicker,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteTransaction,
  } = useTransactionEditor(accountId);

  const categoryGroups = useMemo(() => {
    const groups: { parent: CategoryWithCount; children: CategoryWithCount[] }[] = [];
    const parents = categories.filter(c => c.parentId === null);
    const childrenMap = new Map<string, CategoryWithCount[]>();

    categories.filter(c => c.parentId !== null).forEach(child => {
      if (child.parentId) {
        const list = childrenMap.get(child.parentId) || [];
        list.push(child);
        childrenMap.set(child.parentId, list);
      }
    });

    parents.forEach(parent => {
      const children = parent.id ? childrenMap.get(parent.id) : undefined;
      if (children && children.length > 0) {
        groups.push({ parent, children });
      }
    });

    return groups.sort((a, b) => (a.parent.name || '').localeCompare(b.parent.name || ''));
  }, [categories]);

  if (!transaction) {
    return (
      <div className="w-96 bg-white dark:bg-zinc-950 border-l border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-500">
        Select a transaction to view details
      </div>
    );
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      await deleteTransaction(transaction.id);
    }
  };

  return (
    <div className="w-96 bg-white dark:bg-zinc-950 border-l border-gray-200 dark:border-gray-800 flex flex-col">
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Header: Description */}
        <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {transaction.description}
        </p>

        {/* Amount */}
        <p
          className={cn(
            'text-xl font-semibold tabular-nums font-mono mb-8',
            transaction.amountOriginal >= 0
              ? 'text-green-600 dark:text-green-500'
              : 'text-red-600 dark:text-red-500'
          )}
        >
          {formatCurrency(transaction.amountOriginal, transaction.currencyOriginal)}
        </p>

        {/* Date */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Date
            </p>
          </div>
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
                    })() : <span>Pick a date</span>}
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
              className="text-sm font-normal text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1 -mx-2 rounded"
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
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-gray-400" />
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Category
            </p>
          </div>
          {editingField === 'category_id' ? (
            <div className="flex items-center gap-2">
              <Select
                value={String(editedValue || '')}
                onValueChange={(value) => setEditedValue(value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryGroups.map((group) => (
                    <SelectGroup key={group.parent.id}>
                      <SelectLabel>{group.parent.name}</SelectLabel>
                      {group.children.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          # {category.name}
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
            <p
              className="text-sm font-normal text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1 -mx-2 rounded"
              onClick={() => startEdit('category_id', transaction.categoryId)}
            >
              {transaction.categoryName ? `# ${transaction.categoryName}` : 'Uncategorized'}
            </p>
          )}
        </div>

        {/* Bank Account */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-gray-400" />
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Bank Account
            </p>
          </div>
          {editingField === 'account_id' ? (
            <div className="flex items-center gap-2">
              <Select
                value={String(editedValue || '')}
                onValueChange={(value) => setEditedValue(value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select account" />
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
              className="text-sm font-normal text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1 -mx-2 rounded"
              onClick={() => startEdit('account_id', transaction.accountId)}
            >
              {transaction.accountName}
              {transaction.currencyOriginal && (
                <span className="text-gray-500 dark:text-gray-400 ml-2">
                  ({transaction.currencyOriginal})
                </span>
              )}
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Notes
            </p>
          </div>
          {editingField === 'notes' ? (
            <div className="flex items-start gap-2">
              <Textarea
                value={(editedValue as string) || ''}
                onChange={(e) => setEditedValue(e.target.value)}
                placeholder="Add a note..."
                className="resize-none text-sm flex-1 bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20"
                rows={4}
                autoFocus
              />
              <div className="flex flex-col gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-green-600"
                  onClick={() => saveEdit(transaction.id, 'notes', editedValue)}
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
            </div>
          ) : (
            <div
              className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-lg p-3 min-h-[80px] cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20"
              onClick={() => startEdit('notes', transaction.notes)}
            >
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {transaction.notes || 'No notes'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end px-8 py-4 border-t border-gray-200 dark:border-gray-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
        >
          Delete Transaction
        </Button>
      </div>
    </div>
  );
}
