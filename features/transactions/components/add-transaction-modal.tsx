'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { format } from 'date-fns';
import { useAddTransaction } from '../hooks/use-transactions';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Wallet, DollarSign } from 'lucide-react';
import { VALIDATION, TRANSACTIONS, CURRENCY } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { FormModal } from '@/components/shared/form-modal';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Schema for the form
const transactionSchema = z.object({
  description: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.DESCRIPTION_REQUIRED),
  amount: z.number().min(0.01, VALIDATION.MESSAGES.AMOUNT_MIN),
  date: z.string(),
  categoryId: z.string().min(1, VALIDATION.MESSAGES.CATEGORY_REQUIRED),
  accountId: z.string().min(1, VALIDATION.MESSAGES.ACCOUNT_REQUIRED),
  notes: z.string().optional(),
  currency: z.string().optional(),
  exchangeRate: z.number().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export function AddTransactionModal({ open, onOpenChange }: AddTransactionModalProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const addTransactionMutation = useAddTransaction();
  const { data: categories = [] } = useCategories();
  const { groupedAccounts } = useGroupedAccounts();

  const {
    form,
    error,
    handleClose: resetForm,
    handleSubmit,
  } = useFormModal(transactionSchema, async (data: TransactionFormData) => {
    // data.accountId is now the bank_account_id (from groupedAccounts)
    // We need to find the selected currency
    const selectedAccount = groupedAccounts.find(a => a.account_id === data.accountId);
    if (!selectedAccount) return;

    // If currency is not selected (single currency account), use the first one
    const currencyCode = data.currency || selectedAccount.balances[0]?.currency;
    if (!currencyCode) return;

    await addTransactionMutation.mutateAsync({
      description: data.description,
      amount_original: data.amount,
      date: data.date,
      category_id: data.categoryId,
      account_id: data.accountId,
      notes: data.notes,
      currency_original: currencyCode,
      exchange_rate: data.exchangeRate || CURRENCY.DEFAULTS.EXCHANGE_RATE,
    });
    handleClose();
  }, {
    defaultValues: {
      date: new Date().toISOString(),
      notes: '',
      exchangeRate: 1,
    },
  });

  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = form;

  const selectedCategoryId = watch('categoryId');
  const selectedAccountId = watch('accountId');
  const selectedCurrency = watch('currency');

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const selectedAccount = groupedAccounts.find(a => a.account_id === selectedAccountId);

  // Determine available currencies for the selected account
  const availableCurrencies = useMemo(() => {
    return selectedAccount?.balances.map((b) => b.currency).filter((c): c is string => !!c) || [];
  }, [selectedAccount]);

  const showCurrencySelector = availableCurrencies.length > 1;

  // Set default currency if account changes and has only one currency
  useEffect(() => {
    if (selectedAccount && availableCurrencies.length === 1) {
      setValue('currency', availableCurrencies[0]);
    } else if (selectedAccount && !selectedCurrency && availableCurrencies.length > 0) {
      // Default to first currency if none selected
      setValue('currency', availableCurrencies[0]);
    }
  }, [selectedAccountId, selectedAccount, availableCurrencies, setValue, selectedCurrency]);

  useEffect(() => {
    if (open) {
      setDate(new Date());
      setValue('date', new Date().toISOString());
    }
  }, [open, setValue]);

  const handleClose = () => {
    resetForm();
    setDate(new Date());
    onOpenChange(false);
  };

  return (
    <FormModal
      open={open}
      onOpenChange={handleClose}
      onSubmit={(e) => void handleSubmit(e)}
      isSubmitting={form.formState.isSubmitting}
      submitLabel={TRANSACTIONS.UI.BUTTONS.ADD}
      cancelLabel={TRANSACTIONS.UI.BUTTONS.CANCEL}
      error={error}
      maxWidth="sm:max-w-[600px]"
    >
      <div className="space-y-4">
        {/* Row 1: Description and Amount */}
        <div className="flex gap-4 items-start">
          <div className="flex-1 space-y-2">
            <Input
              id="description"
              placeholder={TRANSACTIONS.UI.LABELS.DESCRIPTION_PLACEHOLDER}
              {...register('description')}
              disabled={form.formState.isSubmitting}
              className="text-lg font-medium border-none shadow-none px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="w-[120px] space-y-2">
            <div className="relative">
              <DollarSign className="absolute left-0 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step={CURRENCY.STEP.STANDARD}
                placeholder="0.00"
                className="pl-6 text-lg font-medium text-right border-none shadow-none px-0 focus-visible:ring-0"
                {...register('amount', { valueAsNumber: true })}
                disabled={form.formState.isSubmitting}
              />
            </div>
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount.message}</p>
            )}
          </div>
        </div>

        {/* Row 2: Note */}
        <div className="space-y-2">
          <Input
            id="notes"
            placeholder="Add a note..."
            {...register('notes')}
            disabled={form.formState.isSubmitting}
            className="text-sm border-none shadow-none px-0 focus-visible:ring-0 text-muted-foreground"
          />
          {errors.notes && (
            <p className="text-sm text-red-500">{errors.notes.message}</p>
          )}
        </div>

        <div className="border-t border-border/50 my-2" />

        {/* Row 3: Icons (Date, Category, Account, Currency, Exchange Rate) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-2 text-muted-foreground hover:text-foreground",
                  date && "text-foreground bg-accent/50"
                )}
                type="button"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, 'MMM d') : <span>Date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(selectedDate) => {
                  setDate(selectedDate);
                  if (selectedDate) {
                    setValue('date', selectedDate.toISOString());
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Category Select */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-2 text-muted-foreground hover:text-foreground",
                  selectedCategoryId && "text-foreground bg-accent/50"
                )}
                type="button"
              >
                {selectedCategory ? (
                  <>
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: selectedCategory.color || undefined }}
                    />
                    {selectedCategory.name}
                  </>
                ) : (
                  <>
                    <span className="mr-2">#</span>
                    <span>Category</span>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <div className="p-2">
                {categories.filter(c => c.id !== null).map((category) => (
                  <div
                    key={category.id!}
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                    onClick={() => setValue('categoryId', category.id!)}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color || undefined }}
                    />
                    <span className="text-sm">{category.name}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Account Select */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-2 text-muted-foreground hover:text-foreground",
                  selectedAccountId && "text-foreground bg-accent/50"
                )}
                type="button"
              >
                <Wallet className="mr-2 h-4 w-4" />
                {selectedAccount ? selectedAccount.name : "Account"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <div className="p-2">
                {groupedAccounts.map((account) => (
                  <div
                    key={account.account_id}
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                    onClick={() => setValue('accountId', account.account_id)}
                  >
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{account.name}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Currency Select (Only if multiple currencies) */}
          {showCurrencySelector && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 px-2 text-muted-foreground hover:text-foreground",
                    selectedCurrency && "text-foreground bg-accent/50"
                  )}
                  type="button"
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  {selectedCurrency || "Currency"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[120px] p-0" align="start">
                <div className="p-2">
                  {availableCurrencies.map((currency: string) => (
                    <div
                      key={currency}
                      className="flex items-center gap-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                      onClick={() => setValue('currency', currency)}
                    >
                      <span className="text-sm font-medium">{currency}</span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Exchange Rate Input (Only if currency selected) */}
          {selectedCurrency && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-muted-foreground">Rate:</span>
              <Input
                type="number"
                step="0.01"
                placeholder="1.00"
                className="h-8 w-20 text-sm"
                {...register('exchangeRate', { valueAsNumber: true })}
              />
            </div>
          )}

        </div>

        {/* Hidden validation messages for required fields if not touched */}
        <div className="flex gap-4 flex-wrap">
          {errors.date && !date && <p className="text-xs text-red-500">{errors.date.message}</p>}
          {errors.categoryId && !selectedCategoryId && <p className="text-xs text-red-500">{errors.categoryId.message}</p>}
          {errors.accountId && !selectedAccountId && <p className="text-xs text-red-500">{errors.accountId.message}</p>}
          {errors.currency && showCurrencySelector && !selectedCurrency && <p className="text-xs text-red-500">{errors.currency.message}</p>}
        </div>
      </div>
    </FormModal>
  );
}
