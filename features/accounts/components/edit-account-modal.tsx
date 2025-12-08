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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { CreditCard, Pencil, X, Plus, Trash2, Loader2, Check, ChevronDown } from 'lucide-react';
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
  originalStartingBalance: number;
}

export function EditAccountModal({ open, onOpenChange, account, onDelete }: EditAccountModalProps) {
  const queryClient = useQueryClient();

  const [currencyReplacements, setCurrencyReplacements] = useState<CurrencyReplacement[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);
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
      const isNewCurrency = replacement.oldCurrency.id.startsWith('new-');

      if (isNewCurrency) {
        await accountCurrenciesApi.replaceCurrency(
          account.id,
          oldCode,
          newCode,
          replacement.newStartingBalance
        );
      } else if (oldCode !== newCode) {
        await accountCurrenciesApi.replaceCurrency(
          account.id,
          oldCode,
          newCode,
          replacement.newStartingBalance
        );
      } else if (replacement.newStartingBalance !== replacement.originalStartingBalance) {
        await accountCurrenciesApi.replaceCurrency(
          account.id,
          oldCode,
          newCode,
          replacement.newStartingBalance
        );
      }
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNT_CURRENCIES() });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL });

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
    setIsColorPopoverOpen(false);
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
  const accountName = watch('name');

  // Initialize form and currency replacements
  useEffect(() => {
    if (account && accountCurrencies.length > 0) {
      reset({
        name: account.name,
        color: account.color || ACCOUNT.DEFAULT_COLOR,
      });

      setCurrencyReplacements(
        accountCurrencies.map((ac) => ({
          oldCurrency: ac,
          newCurrencyCode: ac.currency_code,
          newStartingBalance: 0,
          originalStartingBalance: 0,
        }))
      );
    }
  }, [account, accountCurrencies, reset]);

  // Click-outside detection
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
    if (currencyReplacements.some(cr => cr.newCurrencyCode === currencyCode)) {
      return;
    }

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

  // Get first letter for icon
  const getInitial = () => {
    return accountName ? accountName.charAt(0).toUpperCase() : 'A';
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Modal Container */}
          <DialogPrimitive.Content className="relative w-full max-w-lg max-h-[85vh] outline-none animate-in fade-in zoom-in-95 duration-200">
            <VisuallyHidden>
              <DialogPrimitive.Title>Edit Account</DialogPrimitive.Title>
              <DialogPrimitive.Description>
                Edit account name, color, and manage currencies
              </DialogPrimitive.Description>
            </VisuallyHidden>
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Close Button (Absolute) */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Hero Header (Merged Layout) - Fixed */}
              <div className="px-8 pt-10 pb-6 shrink-0">
                <div className="flex items-start gap-4">
                  {/* Icon Anchor (Color Trigger) */}
                  <Popover open={isColorPopoverOpen} onOpenChange={setIsColorPopoverOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <button
                          type="button"
                          className="w-14 h-14 rounded-2xl ring-1 ring-black/5 flex items-center justify-center text-white text-xl font-bold drop-shadow-md hover:scale-105 transition-transform cursor-pointer"
                          style={{ backgroundColor: selectedColor }}
                        >
                          {getInitial()}
                        </button>
                        <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-sm">
                          <ChevronDown className="w-3 h-3 text-gray-400" />
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-3 bg-white rounded-2xl shadow-xl border border-gray-100">
                      <div className="grid grid-cols-5 gap-3">
                        {ACCOUNT.COLOR_PALETTE.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              setValue('color', color, { shouldDirty: true });
                              setIsColorPopoverOpen(false);
                            }}
                            className={cn(
                              'w-8 h-8 rounded-full transition-all flex items-center justify-center',
                              selectedColor === color && 'ring-2 ring-offset-2 ring-gray-900'
                            )}
                            style={{ backgroundColor: color }}
                          >
                            {selectedColor === color && (
                              <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
                            )}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Title Input (Hero Text) */}
                  <div className="flex-1 relative group">
                    <Input
                      {...register('name')}
                      className={cn(
                        'text-2xl font-bold text-gray-900 border-transparent bg-transparent hover:bg-gray-50 hover:border-gray-200 focus:bg-white focus:border-blue-200 ring-0 focus:ring-0 px-4 py-2 rounded-xl transition-all',
                        errors.name && 'border-red-300'
                      )}
                      placeholder="Account name"
                    />
                    <Pencil className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    {errors.name && <p className="text-xs text-red-500 mt-1 px-4">{errors.name.message}</p>}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-50 shrink-0" />

              {/* Body Section - Scrollable */}
              <div className="px-8 py-6 space-y-6 overflow-y-auto flex-1">
                {/* Error Display */}
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">
                    {error}
                  </div>
                )}

                {/* Currencies & Balances */}
                <div className="space-y-4">
                  {/* Header Row */}
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
                        className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Currency
                      </button>

                      {/* Currency Dropdown */}
                      {isDropdownOpen && (
                        <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden max-h-48 overflow-y-auto min-w-[280px] animate-in fade-in zoom-in-95">
                          {availableCurrencies.length > 0 ? (
                            availableCurrencies.map((currency) => (
                              <div
                                key={currency.code}
                                onClick={() => handleAddCurrency(currency.code)}
                                className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-2 transition-colors"
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
                    <div className="text-center text-sm text-gray-500 p-4 bg-gray-50/30 border border-gray-100 rounded-xl">
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
                              <div className="w-16 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg py-2 text-center">
                                {replacement.newCurrencyCode}
                              </div>

                              {/* Amount Input with Symbol */}
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
                                  placeholder="0"
                                  className="font-mono text-sm text-right bg-gray-50 border-transparent focus:bg-white focus:border-blue-200 rounded-lg pl-8 pr-4 py-2"
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

                            {/* Warning */}
                            {replacement.oldCurrency.currency_code !== replacement.newCurrencyCode &&
                             !replacement.oldCurrency.id.startsWith('new-') && (
                              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg ml-[76px]">
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

              {/* Footer - Fixed */}
              <div className="bg-white rounded-b-3xl border-t border-gray-100 p-4 flex gap-3 shrink-0">
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
                  className="flex-1 bg-gray-900 hover:bg-black text-white font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl transition-all"
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
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
