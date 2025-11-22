'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts';
import { accountCurrenciesApi } from '../api/account-currencies';
import { updateAccountSchema, type UpdateAccountFormData } from '../schemas/account.schema';
import { useCurrencies, useAddCurrency } from '@/features/currencies/hooks/use-currencies';
import type { Database } from '@/types/database.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT } from '@/lib/constants';
import { AccountForm } from './account-form';

type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];
type AccountCurrency = Database['public']['Tables']['account_currencies']['Row'];

interface EditAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount | null;
}

interface CurrencyReplacement {
  oldCurrency: AccountCurrency;
  newCurrencyCode: string;
  newStartingBalance: number;
}

export function EditAccountModal({ open, onOpenChange, account }: EditAccountModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currencyReplacements, setCurrencyReplacements] = useState<CurrencyReplacement[]>([]);

  const { data: allCurrencies = [] } = useCurrencies();
  const addCurrencyMutation = useAddCurrency();

  // Fetch account currencies when modal opens
  const { data: accountCurrencies = [], isLoading: loadingCurrencies } = useQuery({
    queryKey: ['account-currencies', account?.id],
    queryFn: () => accountCurrenciesApi.getByAccountId(account!.id),
    enabled: !!account?.id && open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<UpdateAccountFormData>({
    resolver: zodResolver(updateAccountSchema),
  });

  const selectedColor = watch('color');

  // Initialize form and currency replacements when account or currencies change
  useEffect(() => {
    if (account && accountCurrencies.length > 0) {
      reset({
        name: account.name,
        color: account.color || ACCOUNT.DEFAULT_COLOR,
      });

      // Initialize currency replacements
      setCurrencyReplacements(
        accountCurrencies.map((ac) => ({
          oldCurrency: ac,
          newCurrencyCode: ac.currency_code,
          newStartingBalance: ac.starting_balance ?? 0, // Handle null by defaulting to 0
        }))
      );
    }
  }, [account, accountCurrencies, reset]);

  const handleCurrencyChange = (index: number, field: 'newCurrencyCode' | 'newStartingBalance', value: string | number) => {
    setCurrencyReplacements((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, [field]: field === 'newStartingBalance' ? Number(value) : value }
          : item
      )
    );
  };

  const onSubmit = async (data: UpdateAccountFormData) => {
    if (!account) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // Step 1: Update account name
      await accountsApi.update(account.id, data);

      // Step 2: Process currency replacements
      for (const replacement of currencyReplacements) {
        const oldCode = replacement.oldCurrency.currency_code;
        const newCode = replacement.newCurrencyCode.toUpperCase();

        // Skip if currency hasn't changed
        if (oldCode === newCode && replacement.newStartingBalance === replacement.oldCurrency.starting_balance) {
          continue;
        }

        // Ensure the new currency exists in user's currencies
        if (oldCode !== newCode) {
          try {
            await addCurrencyMutation.mutateAsync(newCode);
          } catch (err) {
            // Only log real errors, not duplicates
            console.error('Error adding currency:', err);
          }

          // Replace currency in account and all transactions
          await accountCurrenciesApi.replaceCurrency(
            account.id,
            oldCode,
            newCode,
            replacement.newStartingBalance
          );
        } else {
          // Just update the starting balance
          await accountCurrenciesApi.update(replacement.oldCurrency.id, {
            starting_balance: replacement.newStartingBalance,
          });
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-currencies'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      // Reset and close
      reset();
      setCurrencyReplacements([]);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setCurrencyReplacements([]);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>
            Update account name and manage currencies
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
              {error}
            </div>
          )}

          {/* Account Form Fields */}
          <AccountForm
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
            isSubmitting={isSubmitting}
          />

          {/* Currency Management */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold">Currencies</Label>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Replace currencies in this account. All matching transactions will be updated.
              </p>
            </div>

            {loadingCurrencies ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            ) : currencyReplacements.length === 0 ? (
              <div className="text-center text-sm text-zinc-500 p-4 border border-zinc-200 dark:border-zinc-800 rounded-md">
                No currencies configured for this account
              </div>
            ) : (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-3 gap-4 p-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">FROM</div>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">TO</div>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 text-right">INITIAL AMOUNT</div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {currencyReplacements.map((replacement, index) => (
                    <div key={replacement.oldCurrency.id} className="grid grid-cols-3 gap-4 p-3 items-center">
                      {/* FROM Column - Current Currency (Read-only) */}
                      <div>
                        <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 font-medium text-center">
                          {replacement.oldCurrency.currency_code}
                        </div>
                      </div>

                      {/* TO Column - New Currency (Editable) */}
                      <div>
                        <Input
                          value={replacement.newCurrencyCode}
                          onChange={(e) =>
                            handleCurrencyChange(index, 'newCurrencyCode', e.target.value.toUpperCase())
                          }
                          placeholder="USD"
                          maxLength={3}
                          disabled={isSubmitting}
                          className="uppercase font-medium text-center"
                        />
                      </div>

                      {/* INITIAL AMOUNT Column - Starting Balance (Editable) */}
                      <div>
                        <Input
                          type="number"
                          step="0.01"
                          value={replacement.newStartingBalance}
                          onChange={(e) =>
                            handleCurrencyChange(index, 'newStartingBalance', e.target.value)
                          }
                          disabled={isSubmitting}
                          className="text-right"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Warning message if currency changed */}
                      {replacement.oldCurrency.currency_code !== replacement.newCurrencyCode && (
                        <div className="col-span-3 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                          ⚠️ All {replacement.oldCurrency.currency_code} transactions will be changed to {replacement.newCurrencyCode}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            <Button type="submit" disabled={isSubmitting || loadingCurrencies} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Account'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
