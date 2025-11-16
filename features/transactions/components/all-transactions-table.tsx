'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { format } from 'date-fns';
import { Loader2, Calendar, ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/sidebar';
import { PageHeader } from '@/components/layout/page-header';
import { useSearchParams } from 'next/navigation';
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context';
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
  category_icon: string | null;
  category_id: string | null;
  amount_original: number;
  currency_original: string;
  account_name: string;
  account_id: string;
  exchange_rate: number | null;
  notes: string | null;
}

interface EditableTransaction {
  description?: string | null;
  amount_original?: number;
  date?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  notes?: string | null;
}

type EditingField = 'description' | 'amount' | 'date' | 'category' | 'account' | 'notes' | null;

function TransactionsContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const queryClient = useQueryClient();
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editedValue, setEditedValue] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { isCollapsed } = useSidebar();

  // Mutation for updating transaction
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
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

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'all', accountId],
    queryFn: async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Build query with optional account filter
      let query = supabase
        .from('transactions')
        .select(`
          id,
          date,
          description,
          amount_original,
          currency_original,
          exchange_rate,
          category_id,
          account_id,
          notes
        `)
        .eq('user_id', user.id);

      // Apply account filter if accountId is present
      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data: transactionsData, error } = await query.order('date', { ascending: false });

      if (error) throw error;
      if (!transactionsData) return { transactions: [], accountName: null };

      // Fetch categories
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, icon')
        .or(`user_id.eq.${user.id},user_id.is.null`);

      // Fetch account names
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('id, name')
        .eq('user_id', user.id);

      // Create lookup maps
      const categoryMap = new Map(categories?.map(c => [c.id, c]) || []);
      const accountMap = new Map(accounts?.map(a => [a.id, a]) || []);

      // Enrich transactions with category and account data
      const enrichedData = transactionsData.map(transaction => {
        const category = transaction.category_id ? categoryMap.get(transaction.category_id) : null;
        const account = accountMap.get(transaction.account_id);

        return {
          id: transaction.id,
          date: transaction.date,
          description: transaction.description,
          category_name: category?.name || null,
          category_icon: category?.icon || null,
          category_id: transaction.category_id,
          amount_original: transaction.amount_original,
          currency_original: transaction.currency_original,
          account_name: account?.name || 'Unknown',
          account_id: transaction.account_id,
          exchange_rate: transaction.exchange_rate !== 1 ? transaction.exchange_rate : null,
          notes: transaction.notes,
        };
      });

      return {
        transactions: enrichedData,
        categories: categories || [],
        accounts: accounts || [],
        accountName: accountId && accounts?.length ? accounts.find(a => a.id === accountId)?.name : null,
      };
    },
  });

  const transactions = data?.transactions || [];
  const categories = data?.categories || [];
  const accounts = data?.accounts || [];
  const accountName = data?.accountName;

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: typeof transactions } = {};
    transactions.forEach((transaction) => {
      const dateKey = format(new Date(transaction.date), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(transaction);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      {/* Section 1: Sidebar */}
      <Sidebar />

      {/* Section 2: Transactions List */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-800">
        {/* Header */}
        <PageHeader title={accountName || 'Transactions'} sidebarCollapsed={isCollapsed} />

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-zinc-500 dark:text-zinc-400">
                No transactions found. Start adding transactions to see them here.
              </div>
            </div>
          ) : (
            <div>
              {groupedTransactions.map(([dateKey, dateTransactions]) => (
                <div key={dateKey}>
                  {/* Date Header */}
                  <div className={cn(
                    'transition-all duration-300',
                    isCollapsed ? 'px-32' : 'px-12'
                  )}>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 py-3">
                      {format(new Date(dateKey), 'EEEE dd, MMM yyyy')}
                    </h3>
                  </div>
                  <div className={cn(
                    'border-t border-zinc-200 dark:border-zinc-800 transition-all duration-300',
                    isCollapsed ? 'ml-32' : 'ml-12'
                  )} />

                  {/* Transactions for this date */}
                  <div className={cn(
                    'transition-all duration-300',
                    isCollapsed ? 'ml-32' : 'ml-12'
                  )}>
                    {dateTransactions.map((transaction) => (
                      <div key={transaction.id}>
                        <div
                          onClick={() => setSelectedTransactionId(transaction.id)}
                          className={cn(
                            'py-4 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-300',
                            isCollapsed ? 'pl-8 pr-32' : 'pl-8 pr-12',
                            selectedTransactionId === transaction.id && 'bg-zinc-100 dark:bg-zinc-900'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            {/* Left: Description */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                                {transaction.description}
                              </p>
                            </div>

                            {/* Right: Amount */}
                            <div className="text-right ml-4">
                              <p
                                className={cn(
                                  'text-sm font-semibold tabular-nums',
                                  transaction.amount_original >= 0
                                    ? 'text-green-600 dark:text-green-500'
                                    : 'text-red-600 dark:text-red-500'
                                )}
                              >
                                {formatCurrency(transaction.amount_original, transaction.currency_original)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-zinc-200 dark:border-zinc-800" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Transaction Details Panel */}
      <div className="w-96 bg-white dark:bg-zinc-950 overflow-y-auto flex flex-col">
        {selectedTransactionId ? (
          (() => {
            const transaction = transactions.find(t => t.id === selectedTransactionId);
            if (!transaction) return null;

            const startEdit = (field: EditingField, currentValue: any) => {
              setEditingField(field);
              setEditedValue(currentValue);
            };

            const cancelEdit = () => {
              setEditingField(null);
              setEditedValue(null);
              setShowDatePicker(false);
            };

            const saveEdit = async (field: string, value: any) => {
              if (!selectedTransactionId) return;
              await updateMutation.mutateAsync({ id: selectedTransactionId, field, value });
            };

            return (
              <>
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
                            placeholder="Description"
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
                            placeholder="Amount"
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
                        Date
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
                                {editedValue ? format(new Date(editedValue), 'PPP') : <span>Pick a date</span>}
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
                        Category
                      </p>
                      {editingField === 'category' ? (
                        <div className="flex items-center gap-2">
                          <Select
                            value={editedValue || ''}
                            onValueChange={(value) => setEditedValue(value)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{category.icon}</span>
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
                            onClick={() => saveEdit('category_id', editedValue)}
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
                              <span className="text-lg">{transaction.category_icon}</span>
                              <span className="text-sm text-zinc-900 dark:text-zinc-50">
                                {transaction.category_name}
                              </span>
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-400 dark:text-zinc-500">Uncategorized</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bank Account */}
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                        Bank Account
                      </p>
                      {editingField === 'account' ? (
                        <div className="flex items-center gap-2">
                          <Select
                            value={editedValue || ''}
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
                            onClick={() => saveEdit('account_id', editedValue)}
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
                          Exchange Rate
                        </p>
                        <p className="text-sm text-zinc-900 dark:text-zinc-50">
                          {transaction.exchange_rate.toFixed(4)}
                        </p>
                      </div>
                    )}

                    {/* Notes - Always show */}
                    <div className="group">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                        Notes
                      </p>
                      {editingField === 'notes' ? (
                        <div className="flex items-start gap-2">
                          <Textarea
                            value={editedValue || ''}
                            onChange={(e) => setEditedValue(e.target.value)}
                            placeholder="Add a note..."
                            className="resize-none text-sm flex-1"
                            rows={3}
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
                          {transaction.notes || 'No notes'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()
        ) : (
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
              Select a transaction to view details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AllTransactionsTable() {
  return (
    <SidebarProvider>
      <TransactionsContent />
    </SidebarProvider>
  );
}
