'use client';

'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts';
import { useCurrencies, useAddCurrency } from '@/features/currencies/hooks/use-currencies';
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
import { Loader2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CURRENCY, VALIDATION, QUERY_KEYS, ACCOUNT } from '@/lib/constants';
import { AccountForm } from './account-form';

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Schema for the form
const accountSchema = z.object({
  name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, 'Account name is required'),
  color: z.string().regex(ACCOUNT.COLOR_REGEX, 'Invalid color format'),
});

type AccountFormData = z.infer<typeof accountSchema>;

// Type for currency with balance
interface CurrencyBalance {
  currency_code: string;
  starting_balance: number;
}

export function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [currencyInput, setCurrencyInput] = useState('');
  const [balanceInput, setBalanceInput] = useState('0');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [selectedCurrencies, setSelectedCurrencies] = useState<CurrencyBalance[]>([]);

  const { data: currencies = [], isLoading: isLoadingCurrencies } = useCurrencies();
  const addCurrencyMutation = useAddCurrency();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      color: ACCOUNT.DEFAULT_COLOR,
    },
  });

  const selectedColor = watch('color');

  // Filter currencies based on input and exclude already selected ones
  const filteredCurrencies = useMemo(() => {
    if (!currencyInput) return currencies;
    const search = currencyInput.toUpperCase();
    const selectedCodes = selectedCurrencies.map(c => c.currency_code);
    return currencies.filter(c =>
      c.code.startsWith(search) && !selectedCodes.includes(c.code)
    );
  }, [currencies, currencyInput, selectedCurrencies]);

  const handleAddCurrency = async (code: string) => {
    // Check if currency already selected in this form
    if (selectedCurrencies.some(c => c.currency_code === code)) {
      return;
    }

    // Let the API handle duplicates gracefully with upsert
    await addCurrencyMutation.mutateAsync(code);

    // Add to selected currencies
    setSelectedCurrencies([
      ...selectedCurrencies,
      { currency_code: code, starting_balance: parseFloat(balanceInput) || 0 }
    ]);

    // Reset inputs
    setCurrencyInput('');
    setBalanceInput('0');
    setShowSuggestions(false);
  };

  const handleRemoveCurrency = (code: string) => {
    setSelectedCurrencies(selectedCurrencies.filter(c => c.currency_code !== code));
  };

  const handleUpdateBalance = (code: string, balance: number) => {
    setSelectedCurrencies(selectedCurrencies.map(c =>
      c.currency_code === code ? { ...c, starting_balance: balance } : c
    ));
  };

  const onSubmit = async (data: AccountFormData) => {
    try {
      setError(null);

      // Validation: At least one currency must be selected
      if (selectedCurrencies.length === 0) {
        setError('Please add at least one currency to the account');
        return;
      }

      // ✅ NEW: Use atomic database function instead of two separate operations
      // This guarantees either everything is created or nothing is created
      await accountsApi.createWithCurrencies(
        data.name,
        data.color,
        selectedCurrencies.map(c => ({
          code: c.currency_code,
          starting_balance: c.starting_balance,
        }))
      );

      // Invalidate accounts query to refresh the list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });

      // Reset form and close modal
      reset();
      setSelectedCurrencies([]);
      setCurrencyInput('');
      setBalanceInput('0');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    }
  };

  const handleClose = () => {
    reset();
    setSelectedCurrencies([]);
    setCurrencyInput('');
    setBalanceInput('0');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
          <DialogDescription>
            Create a new account and configure currencies
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          {/* Add Currency Section */}
          <div className="space-y-2">
            <Label htmlFor="currency-input">Add Currencies *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="currency-input"
                  name="currency"
                  type="text"
                  placeholder="Currency (e.g., USD)"
                  value={currencyInput}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setCurrencyInput(value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  maxLength={CURRENCY.CODE_LENGTH}
                  disabled={isSubmitting}
                  className="uppercase"
                  autoComplete="off"
                />

                {/* Suggestions Dropdown */}
                {showSuggestions && currencyInput && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg max-h-48 overflow-auto">
                    {isLoadingCurrencies ? (
                      <div className="p-3 text-center text-sm text-zinc-500">
                        Loading...
                      </div>
                    ) : filteredCurrencies.length > 0 ? (
                      <div className="py-1">
                        {filteredCurrencies.map((currency) => (
                          <button
                            key={currency.id}
                            type="button"
                            onClick={() => handleAddCurrency(currency.code)}
                            className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
                          >
                            {currency.code}
                          </button>
                        ))}
                      </div>
                    ) : currencyInput.length === 3 ? (
                      <button
                        type="button"
                        onClick={() => handleAddCurrency(currencyInput)}
                        className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add "{currencyInput}"</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              <Input
                id="balance-input"
                name="balance"
                type="number"
                step={CURRENCY.STEP.STANDARD}
                placeholder="Balance"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                disabled={isSubmitting}
                className="w-32"
                autoComplete="off"
                aria-label="Starting balance"
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => currencyInput.length === CURRENCY.CODE_LENGTH && handleAddCurrency(currencyInput)}
                disabled={!currencyInput || currencyInput.length !== CURRENCY.CODE_LENGTH || isSubmitting}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Add one or more currencies for this account
            </p>
          </div>

          {/* Selected Currencies List */}
          {selectedCurrencies.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Currencies ({selectedCurrencies.length})</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-md p-2">
                {selectedCurrencies.map((currency) => (
                  <div
                    key={currency.currency_code}
                    className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded"
                  >
                    <span className="font-medium text-sm flex-shrink-0 w-12">
                      {currency.currency_code}
                    </span>
                    <Input
                      id={`balance-${currency.currency_code}`}
                      name={`balance-${currency.currency_code}`}
                      type="number"
                      step={CURRENCY.STEP.STANDARD}
                      value={currency.starting_balance}
                      onChange={(e) =>
                        handleUpdateBalance(currency.currency_code, parseFloat(e.target.value) || 0)
                      }
                      disabled={isSubmitting}
                      className="flex-1"
                      autoComplete="off"
                      aria-label={`Starting balance for ${currency.currency_code}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCurrency(currency.currency_code)}
                      disabled={isSubmitting}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
            <Button type="submit" disabled={isSubmitting} className="flex-1">
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
      </DialogContent>
    </Dialog>
  );
}