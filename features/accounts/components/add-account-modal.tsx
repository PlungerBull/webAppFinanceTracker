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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CreditCard, X, Plus, Trash2, Loader2, Pencil, Check, ChevronDown } from 'lucide-react';
import { VALIDATION, QUERY_KEYS, ACCOUNT, ACCOUNT_UI } from '@/lib/constants';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

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
  const accountName = watch('name');

  // State for color popover
  const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);

  // Get first letter for icon
  const getInitial = () => {
    return accountName ? accountName.charAt(0).toUpperCase() : 'A';
  };

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
        <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">

          {/* Modal Container */}
          <DialogPrimitive.Content className="relative w-full max-w-md max-h-[85vh] bg-white rounded-3xl shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
            <VisuallyHidden>
              <DialogPrimitive.Title>New Account</DialogPrimitive.Title>
              <DialogPrimitive.Description>
                Create a new account with name, color, and currencies
              </DialogPrimitive.Description>
            </VisuallyHidden>

            <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="flex flex-col flex-1 overflow-hidden">
              {/* Hero Header (Icon + Title + Close) - Fixed */}
              <div className="px-6 pt-6 pb-5 flex items-start gap-4 shrink-0">
                {/* Icon Anchor (Color Trigger) */}
                <Popover open={isColorPopoverOpen} onOpenChange={setIsColorPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative shrink-0">
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
                    autoComplete="off"
                  />
                  <Pencil className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  {errors.name && <p className="text-xs text-red-500 mt-1 px-4">{errors.name.message}</p>}
                </div>

                {/* Close Button (Top Right) */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="shrink-0 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mx-6 shrink-0" />

              {/* Body - Scrollable */}
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                {/* Error Display */}
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">
                    {error}
                  </div>
                )}

                {/* Currencies & Balances Section */}
                <div className="space-y-4">
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
                            <div className="w-20 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg py-2 text-center">
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
                                className="font-mono text-sm text-right bg-gray-50 border-transparent hover:bg-white hover:border-gray-200 focus:bg-white focus:border-blue-200 rounded-xl pl-8 pr-4 py-2 transition-all"
                              />
                            </div>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveCurrency(currency.currency_code)}
                              disabled={isSubmitting}
                              className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
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

              {/* Footer - Fixed */}
              <div className="px-6 pb-6 pt-5 shrink-0">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gray-900 hover:bg-black text-white font-bold py-6 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl transition-all active:scale-[0.99]"
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
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
