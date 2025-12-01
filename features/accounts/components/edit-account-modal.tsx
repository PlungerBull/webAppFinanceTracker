'use client';

import { useState, useEffect, useRef } from 'react';
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
import { CreditCard, X, Check, Plus, Trash2, Loader2 } from 'lucide-react';
import { ACCOUNT, ACCOUNT_UI, QUERY_KEYS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';

type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];
type AccountCurrency = Database['public']['Tables']['account_currencies']['Row'];

interface EditAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount | null;
  onDelete?: (accountId: string) => void;
}

interface CurrencyReplacement {
  oldCurrency: AccountCurrency;
  newCurrencyCode: string;
  newStartingBalance: number;
  originalStartingBalance: number; // Track the original balance separately
}

export function EditAccountModal({ open, onOpenChange, account, onDelete }: EditAccountModalProps) {
  const queryClient = useQueryClient();

  const [currencyReplacements, setCurrencyReplacements] = useState<CurrencyReplacement[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  const { data: allCurrencies = [] } = useCurrencies();

  // Fetch account currencies when modal opens
  const { data: accountCurrencies = [], isLoading: loadingCurrencies } = useQuery({
    queryKey: QUERY_KEYS.ACCOUNT_CURRENCIES(account?.id),
    queryFn: () => accountCurrenciesApi.getByAccountId(account!.id),
    enabled: !!account?.id && open,
  });

  const onSubmit = async (data: UpdateAccountFormData) => {
    if (!account) return;

    // Step 1: Update account name and color
    await accountsApi.update(account.id, data);

    // Step 2: Process currency replacements
    for (const replacement of currencyReplacements) {
      const oldCode = replacement.oldCurrency.currency_code;
      const newCode = replacement.newCurrencyCode.toUpperCase();

      // Check if this is a new currency (id starts with 'new-')
      const isNewCurrency = replacement.oldCurrency.id.startsWith('new-');

      if (isNewCurrency) {
        // This is a newly added currency - use replaceCurrency to add it with opening balance
        await accountCurrenciesApi.replaceCurrency(
          account.id,
          oldCode, // Will be the same as newCode for new currencies
          newCode,
          replacement.newStartingBalance
        );
      } else if (oldCode !== newCode) {
        // Replace existing currency with a different one
        await accountCurrenciesApi.replaceCurrency(
          account.id,
          oldCode,
          newCode,
          replacement.newStartingBalance
        );
      } else if (replacement.newStartingBalance !== replacement.originalStartingBalance) {
        // Same currency but balance changed - use replaceCurrency to update opening balance transaction
        await accountCurrenciesApi.replaceCurrency(
          account.id,
          oldCode,
          newCode,
          replacement.newStartingBalance
        );
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
    setIsDropdownOpen(false);
    onOpenChange(false);
  };

  const {
    register,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = form;

  const selectedColor = watch('color');

  // Initialize form and currency replacements when account or currencies change
  useEffect(() => {
    if (account && accountCurrencies.length > 0) {
      reset({
        name: account.name,
        color: account.color || ACCOUNT.DEFAULT_COLOR,
      });

      // Initialize currency replacements
      // Note: Starting balances are stored as transactions with NULL category
      // For now, we initialize to 0 and let the user set the correct value
      setCurrencyReplacements(
        accountCurrencies.map((ac) => ({
          oldCurrency: ac,
          newCurrencyCode: ac.currency_code,
          newStartingBalance: 0, // Will be updated from opening balance transaction
          originalStartingBalance: 0, // Will be updated from opening balance transaction
        }))
      );
    }
  }, [account, accountCurrencies, reset]);

  // Click-outside detection for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        currencyDropdownRef.current &&
        !currencyDropdownRef.current.contains(event.target as Node) &&
        isDropdownOpen
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const handleCurrencyChange = (index: number, field: 'newCurrencyCode' | 'newStartingBalance', value: string | number) => {
    setCurrencyReplacements((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, [field]: field === 'newStartingBalance' ? Number(value) : value }
          : item
      )
    );
  };

  const handleRemoveCurrency = (index: number) => {
    setCurrencyReplacements((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCurrency = (currencyCode: string) => {
    // Check if currency already exists
    if (currencyReplacements.some(cr => cr.newCurrencyCode === currencyCode)) {
      return;
    }

    // Create a new replacement entry
    const newReplacement: CurrencyReplacement = {
      oldCurrency: {
        id: `new-${Date.now()}`,
        account_id: account?.id || '',
        currency_code: currencyCode,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as AccountCurrency,
      newCurrencyCode: currencyCode,
      newStartingBalance: 0,
      originalStartingBalance: 0,
    };

    setCurrencyReplacements((prev) => [...prev, newReplacement]);
    setIsDropdownOpen(false);
  };

  // Filter out already selected currencies
  const availableCurrencies = allCurrencies.filter(
    (currency) => !currencyReplacements.some((cr) => cr.newCurrencyCode === currency.code)
  );

  const handleDelete = async () => {
    if (!account || !onDelete) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${account.name}"? This action cannot be undone.`
    );

    if (confirmed) {
      onDelete(account.id);
      handleClose();
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 animate-in fade-in duration-200" />

        {/* Modal Container */}
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] outline-none animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl shadow-2xl overflow-visible flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-gray-50 p-2 rounded-full">
                  <CreditCard className="w-[18px] h-[18px] text-gray-400" />
                </div>
                <DialogPrimitive.Title asChild>
                  <h2 className="text-sm font-bold text-gray-900">Edit Account</h2>
                </DialogPrimitive.Title>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Error Display */}
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">
                  {error}
                </div>
              )}

              {/* Account Name Input */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase">
                  ACCOUNT NAME
                </Label>
                <Input
                  {...register('name')}
                  autoComplete="off"
                  placeholder="e.g. BCP Credito, Wallet"
                  disabled={isSubmitting}
                  className="text-lg text-gray-800 bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-xl px-4 py-3"
                />
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Color Picker */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase">
                  COLOR THEME
                </Label>
                <div className="grid grid-cols-5 gap-3">
                  {ACCOUNT.COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setValue('color', color, { shouldDirty: true })}
                      disabled={isSubmitting}
                      className={cn(
                        "w-10 h-10 rounded-full transition-all flex items-center justify-center hover:scale-110",
                        selectedColor === color
                          ? "scale-110 ring-2 ring-offset-2 ring-gray-300 shadow-md"
                          : ""
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {selectedColor === color && (
                        <Check className="w-5 h-5 text-white drop-shadow-md" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currencies & Balances Section */}
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Currencies & Balances
                  </span>

                  {/* Add Currency Dropdown */}
                  <div className="relative" ref={currencyDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      disabled={isSubmitting}
                      className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Currency
                    </button>

                    {/* Currency Dropdown */}
                    {isDropdownOpen && (
                      <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden max-h-48 overflow-y-auto min-w-[280px]">
                        {availableCurrencies.length > 0 ? (
                          availableCurrencies.map((currency) => (
                            <div
                              key={currency.code}
                              onClick={() => handleAddCurrency(currency.code)}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                            >
                              {currency.flag && <span>{currency.flag}</span>}
                              <span className="font-medium text-sm">{currency.code}</span>
                              <span className="text-xs text-gray-500">- {currency.name}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-center text-sm text-gray-500">
                            All currencies added
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Currency List */}
                {loadingCurrencies ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : currencyReplacements.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 p-4 border border-gray-200 rounded-xl">
                    No currencies added yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currencyReplacements.map((replacement, index) => {
                      const currencyData = allCurrencies.find(c => c.code === replacement.newCurrencyCode);
                      const currencySymbol = currencyData?.symbol || replacement.newCurrencyCode;

                      return (
                        <div key={replacement.oldCurrency.id} className="space-y-2">
                          <div className="flex items-center gap-3 animate-in slide-in-from-left-2 fade-in">
                            {/* Currency Badge */}
                            <div className="w-20 text-xs font-bold text-gray-700 bg-gray-100 rounded py-2 text-center">
                              {replacement.newCurrencyCode}
                            </div>

                            {/* Amount Input with Currency Symbol */}
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                {currencySymbol}
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                value={replacement.newStartingBalance}
                                onChange={(e) =>
                                  handleCurrencyChange(index, 'newStartingBalance', e.target.value)
                                }
                                disabled={isSubmitting}
                                className="font-mono text-sm text-right bg-gray-50 border-transparent focus:bg-white focus:border-blue-200 rounded-xl pl-8 pr-4 py-2"
                              />
                            </div>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveCurrency(index)}
                              disabled={isSubmitting}
                              className="p-2 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Warning if currency code changed */}
                          {replacement.oldCurrency.currency_code !== replacement.newCurrencyCode &&
                           !replacement.oldCurrency.id.startsWith('new-') && (
                            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded ml-[88px]">
                              ⚠️ Changing from {replacement.oldCurrency.currency_code} to {replacement.newCurrencyCode} will update all transactions
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 shrink-0 flex gap-3">
              {/* Delete Account Button */}
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="bg-red-50 text-red-600 hover:bg-red-100 p-3 rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              {/* Save Changes Button */}
              <Button
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
