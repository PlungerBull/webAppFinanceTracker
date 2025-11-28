'use client';

import { useState, useEffect } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts';
import { accountCurrenciesApi } from '../api/account-currencies';
import { updateAccountSchema, type UpdateAccountFormData } from '../schemas/account.schema';
import { useCurrencies } from '@/features/currencies/hooks/use-currencies';
import type { Database } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { ACCOUNT, ACCOUNT_UI, QUERY_KEYS } from '@/lib/constants';
import { AccountForm } from './account-form';
import { FormModal } from '@/components/shared/form-modal';

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

  const [currencyReplacements, setCurrencyReplacements] = useState<CurrencyReplacement[]>([]);

  const { data: allCurrencies = [] } = useCurrencies();

  // Fetch account currencies when modal opens
  const { data: accountCurrencies = [], isLoading: loadingCurrencies } = useQuery({
    queryKey: QUERY_KEYS.ACCOUNT_CURRENCIES(account?.id),
    queryFn: () => accountCurrenciesApi.getByAccountId(account!.id),
    enabled: !!account?.id && open,
  });

  const onSubmit = async (data: UpdateAccountFormData) => {
    if (!account) return;

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

      if (oldCode !== newCode) {
        // Replace currency in account and all transactions
        // Note: Currency must exist in global_currencies table (enforced by FK)
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
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNT_CURRENCIES() });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL });

    // Reset and close
    setCurrencyReplacements([]);
    onOpenChange(false);
  };

  const {
    form,
    error,
    handleClose: resetForm,
    handleSubmit,
  } = useFormModal(updateAccountSchema, onSubmit);

  const handleClose = () => {
    resetForm();
    setCurrencyReplacements([]);
    onOpenChange(false);
  };

  const {
    register,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = form;

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

  return (
    <FormModal
      open={open}
      onOpenChange={handleClose}
      title={ACCOUNT_UI.LABELS.EDIT_ACCOUNT}
      description={ACCOUNT_UI.DESCRIPTIONS.EDIT_ACCOUNT}
      onSubmit={(e) => void handleSubmit(e)}
      isSubmitting={form.formState.isSubmitting}
      submitLabel={ACCOUNT_UI.BUTTONS.UPDATE}
      cancelLabel={ACCOUNT_UI.BUTTONS.CANCEL}
      error={error}
      maxWidth="sm:max-w-[600px]"
    >
      {/* Account Form Fields */}
      <AccountForm
        register={register}
        errors={errors}
        setValue={setValue}
        watch={watch}
        isSubmitting={form.formState.isSubmitting}
      />

      {/* Currency Management */}
      <div className="space-y-3">
        <div>
          <Label className="text-base font-semibold">{ACCOUNT_UI.LABELS.CURRENCIES}</Label>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {ACCOUNT_UI.DESCRIPTIONS.REPLACE_CURRENCIES}
          </p>
        </div>

        {loadingCurrencies ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : currencyReplacements.length === 0 ? (
          <div className="text-center text-sm text-zinc-500 p-4 border border-zinc-200 dark:border-zinc-800 rounded-md">
            {ACCOUNT_UI.MESSAGES.NO_CURRENCIES}
          </div>
        ) : (
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-3 gap-4 p-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{ACCOUNT_UI.LABELS.TABLE_FROM}</div>
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{ACCOUNT_UI.LABELS.TABLE_TO}</div>
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 text-right">{ACCOUNT_UI.LABELS.TABLE_INITIAL_AMOUNT}</div>
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
                      placeholder={ACCOUNT_UI.LABELS.CURRENCY_PLACEHOLDER.split('(')[1].replace(')', '')}
                      maxLength={3}
                      disabled={form.formState.isSubmitting}
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
                      disabled={form.formState.isSubmitting}
                      className="text-right"
                      placeholder={ACCOUNT_UI.LABELS.BALANCE_PLACEHOLDER}
                    />
                  </div>

                  {/* Warning message if currency changed */}
                  {replacement.oldCurrency.currency_code !== replacement.newCurrencyCode && (
                    <div className="col-span-3 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                      {ACCOUNT_UI.MESSAGES.CURRENCY_CHANGE_WARNING(replacement.oldCurrency.currency_code, replacement.newCurrencyCode)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FormModal>
  );
}

