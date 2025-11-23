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
  notes: z.string().optional(),
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
      notes: data.notes,
      currency_original: CURRENCY.DEFAULT,
      exchange_rate: CURRENCY.DEFAULTS.EXCHANGE_RATE,
    });
    handleClose();
  }, {
    defaultValues: {
      date: new Date().toISOString(),
      notes: '',
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

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

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

        {/* Row 3: Icons (Date, Category, Account) */}
        <div className="flex items-center gap-2">
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
                {accounts.filter(a => a.id !== null).map((account) => (
                  <div
                    key={account.id!}
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                    onClick={() => setValue('accountId', account.id!)}
                  >
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{account.name}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Hidden validation messages for required fields if not touched */}
        <div className="flex gap-4">
          {errors.date && !date && <p className="text-xs text-red-500">{errors.date.message}</p>}
          {errors.categoryId && !selectedCategoryId && <p className="text-xs text-red-500">{errors.categoryId.message}</p>}
          {errors.accountId && !selectedAccountId && <p className="text-xs text-red-500">{errors.accountId.message}</p>}
        </div>
      </div>
    </FormModal>
  );
}
