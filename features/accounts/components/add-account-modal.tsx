'use client';

import { useState, useEffect, useRef } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { useCurrencyManager } from '@/hooks/use-currency-manager';
import { useCurrencies } from '@/features/currencies/hooks/use-currencies';
import { useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, X, Check, Plus, Trash2, Loader2 } from 'lucide-react';
import { VALIDATION, QUERY_KEYS, ACCOUNT, ACCOUNT_UI } from '@/lib/constants';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Schema for the form
const accountSchema = z.object({
  name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, ACCOUNT_UI.MESSAGES.ACCOUNT_NAME_REQUIRED),
  color: z.string().regex(ACCOUNT.COLOR_REGEX, 'Invalid color format'),
});

type AccountFormData = z.infer<typeof accountSchema>;

export function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const queryClient = useQueryClient();
  const {
    selectedCurrencies,
    handleAddCurrency,
    handleRemoveCurrency,
    handleUpdateBalance,
    resetCurrencies,
  } = useCurrencyManager();

  const { data: currencies = [], isLoading: isLoadingCurrencies } = useCurrencies();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  const onSubmit = async (data: AccountFormData) => {
    // Validation: At least one currency must be selected
    if (selectedCurrencies.length === 0) {
      throw new Error(ACCOUNT_UI.MESSAGES.AT_LEAST_ONE_CURRENCY);
    }

    await accountsApi.createWithCurrencies(
      data.name,
      data.color,
      selectedCurrencies.map((c) => ({
        code: c.currency_code,
        starting_balance: c.starting_balance,
      }))
    );

    // Invalidate accounts query to refresh the list
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });

    // Reset currencies and close modal
    resetCurrencies();
    onOpenChange(false);
  };

  const {
    form,
    error,
    handleClose: resetForm,
    handleSubmit,
  } = useFormModal(accountSchema, onSubmit, {
    defaultValues: {
      color: ACCOUNT.DEFAULT_COLOR,
    },
  });

  const handleClose = () => {
    resetForm();
    resetCurrencies();
    onOpenChange(false);
  };

  const {
    register,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = form;

  const selectedColor = watch('color');

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

  // Filter out already selected currencies
  const availableCurrencies = currencies.filter(
    (currency) => !selectedCurrencies.some((c) => c.currency_code === currency.code)
  );

  const handleAddCurrencyFromDropdown = async (code: string) => {
    await handleAddCurrency(code);
    setIsDropdownOpen(false);
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
                  <h2 className="text-sm font-bold text-gray-900">New Account</h2>
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
                        {isLoadingCurrencies ? (
                          <div className="px-4 py-3 text-center text-sm text-gray-500">
                            Loading...
                          </div>
                        ) : availableCurrencies.length > 0 ? (
                          availableCurrencies.map((currency) => (
                            <div
                              key={currency.code}
                              onClick={() => handleAddCurrencyFromDropdown(currency.code)}
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

                {/* Selected Currencies List */}
                {selectedCurrencies.length > 0 && (
                  <div className="space-y-2">
                    {selectedCurrencies.map((currency) => {
                      const currencyData = currencies.find(c => c.code === currency.currency_code);
                      const currencySymbol = currencyData?.symbol || currency.currency_code;

                      return (
                        <div
                          key={currency.currency_code}
                          className="flex items-center gap-3 animate-in slide-in-from-left-2 fade-in"
                        >
                          {/* Currency Badge */}
                          <div className="w-20 text-xs font-bold text-gray-700 bg-gray-100 rounded py-2 text-center">
                            {currency.currency_code}
                          </div>

                          {/* Amount Input with Currency Symbol */}
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                              {currencySymbol}
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              value={currency.starting_balance}
                              onChange={(e) =>
                                handleUpdateBalance(currency.currency_code, parseFloat(e.target.value) || 0)
                              }
                              disabled={isSubmitting}
                              className="font-mono text-sm text-right bg-gray-50 border-transparent focus:bg-white focus:border-blue-200 rounded-xl pl-8 pr-4 py-2"
                            />
                          </div>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveCurrency(currency.currency_code)}
                            disabled={isSubmitting}
                            className="p-2 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 shrink-0">
              <Button
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-6 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
