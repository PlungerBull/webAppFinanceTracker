'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { format } from 'date-fns';
import { Calendar, Check, X, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRANSACTIONS, CURRENCY, UI } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

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

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Account {
  id: string;
  name: string;
}

interface TransactionDetailPanelProps {
  transaction: TransactionRow | null;
  categories: Category[];
  accounts: Account[];
  accountId: string | null;
}

type EditingField = 'description' | 'amount' | 'date' | 'category' | 'account' | 'notes' | null;

export function TransactionDetailPanel({
  transaction,
  categories,
  accounts,
  accountId,
}: TransactionDetailPanelProps) {
  const queryClient = useQueryClient();
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editedValue, setEditedValue] = useState<string | number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Mutation for updating transaction
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string | number | null }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('transactions')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', 'all', accountId] });
      setEditingField(null);
      setEditedValue(null);
      setShowDatePicker(false);
    },
  });

  if (!transaction) {
    return (
      <div className="w-96 bg-white dark:bg-zinc-950 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-center h-full p-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
            {TRANSACTIONS.UI.MESSAGES.SELECT_TO_VIEW}
          </p>
        </div>
      </div>
    );
  }

  const startEdit = (field: EditingField, currentValue: string | number | null) => {
    setEditingField(field);
    setEditedValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditedValue(null);
    setShowDatePicker(false);
  };

  const saveEdit = async (field: string, value: string | number | null) => {
    if (!transaction?.id) return;
    await updateMutation.mutateAsync({ id: transaction.id, field, value });
  };

  return (
    <div className="w-96 bg-white dark:bg-zinc-950 overflow-y-auto flex flex-col">
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Top: Description and Amount */}
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
                  onClick={() => saveEdit('description', editedValue)}
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
                  onClick={() => saveEdit('amount_original', editedValue)}
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

        {/* Details Section */}
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
                      {editedValue ? format(new Date(editedValue), 'PPP') : <span>{TRANSACTIONS.UI.LABELS.PICK_DATE}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editedValue ? new Date(editedValue) : undefined}
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
                  onClick={() => saveEdit('date', editedValue)}
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
                {format(new Date(transaction.date), 'MMMM dd, yyyy')}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
              {TRANSACTIONS.UI.LABELS.CATEGORY}
            </p>
            {editingField === 'category' ? (
              <div className="flex items-center gap-2">
                <Select
                  value={String(editedValue || '')}
                  onValueChange={(value) => setEditedValue(value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={TRANSACTIONS.UI.LABELS.SELECT_CATEGORY} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
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
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-green-600"
                  onClick={() => saveEdit('category_id', editedValue || null)}
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
                onClick={() => startEdit('category', transaction.category_id)}
              >
                {transaction.category_name ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 shrink-0"
                      style={{ color: transaction.category_color || undefined }}
                    >
                      <Hash className="w-3 h-3" />
                    </div>
                    <span className="text-sm text-zinc-900 dark:text-zinc-50">
                      {transaction.category_name}
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
            {editingField === 'account' ? (
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
                  onClick={() => saveEdit('account_id', editedValue || null)}
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
                onClick={() => startEdit('account', transaction.account_id)}
              >
                {transaction.account_name}
              </p>
            )}
          </div>

          {/* Exchange Rate - Only show if not 1 */}
          {transaction.exchange_rate && transaction.exchange_rate !== 1 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                {TRANSACTIONS.UI.LABELS.EXCHANGE_RATE}
              </p>
              <p className="text-sm text-zinc-900 dark:text-zinc-50">
                {transaction.exchange_rate.toFixed(CURRENCY.FORMAT.EXCHANGE_RATE_PRECISION)}
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
                    onClick={() => saveEdit('notes', editedValue)}
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
      </div>
    </div>
  );
}
