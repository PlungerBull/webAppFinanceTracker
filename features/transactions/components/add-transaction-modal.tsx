'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { useAddTransaction } from '../hooks/use-transactions';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Loader2, CalendarIcon, Tag, Wallet, DollarSign, Hash } from 'lucide-react';
import { ACCOUNT, VALIDATION, TRANSACTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Schema for the form
const transactionSchema = z.object({
  description: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Description is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  date: z.string(),
  categoryId: z.string().min(1, 'Category is required'),
  accountId: z.string().min(1, 'Account is required'),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export function AddTransactionModal({ open, onOpenChange }: AddTransactionModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const addTransactionMutation = useAddTransaction();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date().toISOString(),
    },
  });

  useEffect(() => {
    if (open) {
      setDate(new Date());
      setValue('date', new Date().toISOString());
    }
  }, [open, setValue]);

  const onSubmit = async (data: TransactionFormData) => {
    try {
      setError(null);
      await addTransactionMutation.mutateAsync({
        description: data.description,
        amount_original: data.amount,
        date: data.date,
        category_id: data.categoryId,
        account_id: data.accountId,
        currency_original: 'USD', // Default for now, should come from account
        exchange_rate: 1,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction');
    }
  };

  const handleClose = () => {
    reset();
    setDate(new Date());
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{TRANSACTIONS.UI.LABELS.ADD_TRANSACTION}</DialogTitle>
          <DialogDescription>
            Add a new transaction to track your spending
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
              <Label htmlFor="description">{TRANSACTIONS.UI.LABELS.DESCRIPTION}</Label>
              <Input
                id="description"
                placeholder={TRANSACTIONS.UI.LABELS.DESCRIPTION_PLACEHOLDER}
                {...register('description')}
                disabled={isSubmitting}
                className="text-base font-medium"
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{TRANSACTIONS.UI.LABELS.AMOUNT}</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-9 text-base font-medium text-right"
                  {...register('amount', { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
              </div>
              {errors.amount && (
                <p className="text-sm text-red-500">{errors.amount.message}</p>
              )}
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>{TRANSACTIONS.UI.LABELS.DATE}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                  type="button"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>{TRANSACTIONS.UI.LABELS.PICK_DATE}</span>}
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
            {errors.date && (
              <p className="text-sm text-red-500">{errors.date.message}</p>
            )}
          </div>

          {/* Category Select */}
          <div className="space-y-2">
            <Label>{TRANSACTIONS.UI.LABELS.CATEGORY}</Label>
            <Select
              value={watch('categoryId')}
              onValueChange={(value) => setValue('categoryId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={TRANSACTIONS.UI.LABELS.SELECT_CATEGORY} />
              </SelectTrigger>
              <SelectContent>
                {categories.filter(c => c.id !== null).map((category) => (
                  <SelectItem key={category.id!} value={category.id!}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color || undefined }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p className="text-sm text-red-500">{errors.categoryId.message}</p>
            )}
          </div>

          {/* Account Select */}
          <div className="space-y-2">
            <Label>{TRANSACTIONS.UI.LABELS.ACCOUNT}</Label>
            <Select
              value={watch('accountId')}
              onValueChange={(value) => setValue('accountId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={TRANSACTIONS.UI.LABELS.SELECT_ACCOUNT} />
              </SelectTrigger>
              <SelectContent>
                {accounts.filter(a => a.id !== null).map((account) => (
                  <SelectItem key={account.id!} value={account.id!}>
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                      {account.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.accountId && (
              <p className="text-sm text-red-500">{errors.accountId.message}</p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {TRANSACTIONS.UI.BUTTONS.CANCEL}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {TRANSACTIONS.UI.BUTTONS.ADD}...
                </>
              ) : (
                TRANSACTIONS.UI.BUTTONS.ADD
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
