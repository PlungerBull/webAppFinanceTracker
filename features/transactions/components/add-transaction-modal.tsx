'use client';

import { useState, useEffect } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { format } from 'date-fns';
import { useAddTransaction } from '../hooks/use-transactions';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
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
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export function AddTransactionModal({ open, onOpenChange }: AddTransactionModalProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const addTransactionMutation = useAddTransaction();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();

  const {
    form,
    error,
    handleClose: resetForm,
    handleSubmit,
  } = useFormModal(transactionSchema, async (data: TransactionFormData) => {
    await addTransactionMutation.mutateAsync({
      description: data.description,
      amount_original: data.amount,
      date: data.date,
      category_id: data.categoryId,
      account_id: data.accountId,
      currency_original: CURRENCY.DEFAULT, // Default for now, should come from account
      exchange_rate: CURRENCY.DEFAULTS.EXCHANGE_RATE,
    });
    handleClose();
  }, {
    defaultValues: {
      date: new Date().toISOString(),
    },
  });

  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = form;

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
      title={TRANSACTIONS.UI.LABELS.ADD_TRANSACTION}
      description={TRANSACTIONS.UI.MESSAGES.ADD_DESCRIPTION}
      onSubmit={(e) => void handleSubmit(e)}
      isSubmitting={form.formState.isSubmitting}
      submitLabel={TRANSACTIONS.UI.BUTTONS.ADD}
      cancelLabel={TRANSACTIONS.UI.BUTTONS.CANCEL}
      error={error}
      maxWidth="sm:max-w-[600px]"
    >
      {/* Description and Amount Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="description">{TRANSACTIONS.UI.LABELS.DESCRIPTION}</Label>
          <Input
            id="description"
            placeholder={TRANSACTIONS.UI.LABELS.DESCRIPTION_PLACEHOLDER}
            {...register('description')}
            disabled={form.formState.isSubmitting}
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
              step={CURRENCY.STEP.STANDARD}
              placeholder={TRANSACTIONS.UI.PLACEHOLDERS.AMOUNT}
              className="pl-9 text-base font-medium text-right"
              {...register('amount', { valueAsNumber: true })}
              disabled={form.formState.isSubmitting}
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
    </FormModal>
  );
}
