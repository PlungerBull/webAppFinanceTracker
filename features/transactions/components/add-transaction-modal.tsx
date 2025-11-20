'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { createTransactionSchema, type CreateTransactionFormData } from '../schemas/transaction.schema';
import { useAddTransaction } from '../hooks/use-transactions';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { useAccountCurrencies } from '@/features/accounts/hooks/use-account-currencies';
import { useCurrencies } from '@/features/currencies/hooks/use-currencies';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, CalendarIcon, Tag, Wallet, DollarSign, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTransactionModal({ open, onOpenChange }: AddTransactionModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showExchangeRate, setShowExchangeRate] = useState(false);

  const addTransactionMutation = useAddTransaction();
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();
  const { data: accountBalances = [], isLoading: isLoadingAccounts } = useAccounts();
  const { data: currencies = [] } = useCurrencies();

  // Initialize date on client side to avoid hydration mismatch
  useEffect(() => {
    if (selectedDate === undefined) {
      setSelectedDate(new Date());
    }
  }, [selectedDate]);

  // Get unique accounts (group by account_id since we now have multiple rows per account)
  const accounts = useMemo(() => {
    const accountMap = new Map();
    accountBalances.forEach((balance) => {
      if (!accountMap.has(balance.account_id)) {
        accountMap.set(balance.account_id, {
          id: balance.account_id,
          name: balance.name,
        });
      }
    });
    return Array.from(accountMap.values());
  }, [accountBalances]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<CreateTransactionFormData>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      description: '',
      amount_original: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      exchange_rate: 1,
      notes: '',
    },
  });

  const selectedCategoryId = watch('category_id');
  const selectedAccountId = watch('account_id');
  const selectedCurrency = watch('currency_original');

  // Fetch currencies for selected account (must come after watch() calls)
  const { data: accountCurrencies = [] } = useAccountCurrencies(selectedAccountId);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // Get main currency
  const mainCurrency = currencies.find(c => c.is_main)?.code || currencies[0]?.code || 'USD';

  // Determine if we should show currency selector
  // Show it if the account has multiple currencies
  const shouldShowCurrencyPicker = accountCurrencies.length > 1;

  // Determine if we should show exchange rate input
  // This happens when selected currency is different from main currency
  useEffect(() => {
    if (selectedCurrency && selectedCurrency !== mainCurrency) {
      setShowExchangeRate(true);
    } else {
      setShowExchangeRate(false);
      setValue('exchange_rate', 1);
    }
  }, [selectedCurrency, mainCurrency, setValue]);

  // Auto-set currency when account is selected
  useEffect(() => {
    if (accountCurrencies.length > 0) {
      // If account has only one currency, auto-select it
      if (accountCurrencies.length === 1) {
        setValue('currency_original', accountCurrencies[0].currency_code);
      }
      // If multiple currencies, don't auto-select (user must choose)
    }
  }, [accountCurrencies, setValue]);

  const onSubmit = async (data: CreateTransactionFormData) => {
    try {
      setError(null);
      await addTransactionMutation.mutateAsync(data);

      // Reset form and close modal
      reset();
      setSelectedDate(new Date());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction');
    }
  };

  const handleClose = () => {
    reset();
    setSelectedDate(new Date());
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription className="sr-only">
            Fill in the transaction details including description, amount, date, category, and account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
              {error}
            </div>
          )}

          {/* Description and Amount Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Input
                id="description"
                type="text"
                placeholder="Description"
                {...register('description')}
                disabled={isSubmitting}
                className="text-base font-medium"
              />
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Input
                id="amount_original"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('amount_original', { valueAsNumber: true })}
                disabled={isSubmitting}
                className="text-base font-medium text-right"
              />
              {errors.amount_original && (
                <p className="text-sm text-red-600">{errors.amount_original.message}</p>
              )}
            </div>
          </div>

          {/* Note Field */}
          <div className="space-y-2">
            <Textarea
              placeholder="Add a note..."
              className="resize-none text-sm"
              rows={2}
              disabled={isSubmitting}
              {...register('notes')}
            />
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          {/* Icons Row */}
          <div className="flex items-center gap-2">
            {/* Date Picker */}
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  type="button"
                >
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setValue('date', format(date, 'yyyy-MM-dd'));
                      setShowDatePicker(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Category Picker */}
            <Popover open={showCategoryPicker} onOpenChange={setShowCategoryPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    'h-10 w-10',
                    selectedCategory && 'border-2'
                  )}
                  type="button"
                  style={selectedCategory ? { borderColor: selectedCategory.color } : undefined}
                >
                  {selectedCategory ? (
                    <Hash className="h-4 w-4" style={{ color: selectedCategory.color }} />
                  ) : (
                    <Tag className="h-4 w-4" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <div className="max-h-[300px] overflow-y-auto p-1">
                  {isLoadingCategories ? (
                    <div className="p-4 text-center text-sm text-zinc-500">
                      Loading categories...
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="p-4 text-center text-sm text-zinc-500">
                      No categories found.
                    </div>
                  ) : (
                    categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setValue('category_id', category.id);
                          setShowCategoryPicker(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                      >
                        <div
                          className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 shrink-0"
                          style={{ color: category.color }}
                        >
                          <Hash className="w-3 h-3" />
                        </div>
                        <span>{category.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Account Picker */}
            <Popover open={showAccountPicker} onOpenChange={setShowAccountPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    'h-10 w-10',
                    selectedAccount && 'border-2 border-primary'
                  )}
                  type="button"
                >
                  <Wallet className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <div className="max-h-[300px] overflow-y-auto p-1">
                  {isLoadingAccounts ? (
                    <div className="p-4 text-center text-sm text-zinc-500">
                      Loading accounts...
                    </div>
                  ) : accounts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-zinc-500">
                      No accounts found.
                    </div>
                  ) : (
                    accounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => {
                          setValue('account_id', account.id);
                          setShowAccountPicker(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                      >
                        <Wallet className="h-4 w-4" />
                        <span className="flex-1">{account.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Currency Picker (only shown when account has multiple currencies) */}
            {shouldShowCurrencyPicker && (
              <Popover open={showCurrencyPicker} onOpenChange={setShowCurrencyPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      'h-10 w-10',
                      selectedCurrency && 'border-2 border-primary'
                    )}
                    type="button"
                  >
                    {selectedCurrency ? (
                      <span className="text-xs font-semibold">{selectedCurrency}</span>
                    ) : (
                      <DollarSign className="h-4 w-4" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <div className="max-h-[300px] overflow-y-auto p-1">
                    {accountCurrencies.map((currency) => (
                      <button
                        key={currency.id}
                        type="button"
                        onClick={() => {
                          setValue('currency_original', currency.currency_code);
                          setShowCurrencyPicker(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                      >
                        <span className="font-semibold">{currency.currency_code}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Exchange Rate Input (conditional) */}
            {showExchangeRate && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    type="button"
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px]" align="start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Exchange Rate</p>
                    <p className="text-xs text-zinc-500">
                      1 {selectedCurrency} = ? {mainCurrency}
                    </p>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="1.0000"
                      {...register('exchange_rate', { valueAsNumber: true })}
                      disabled={isSubmitting}
                    />
                    {errors.exchange_rate && (
                      <p className="text-sm text-red-600">{errors.exchange_rate.message}</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Display selected date */}
            <span className="ml-auto text-sm text-zinc-500">
              {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Select date'}
            </span>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || addTransactionMutation.isPending} className="flex-1">
              {isSubmitting || addTransactionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Add Transaction'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
