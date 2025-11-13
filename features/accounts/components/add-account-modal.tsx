'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts';
import { createAccountSchema, type CreateAccountFormData } from '../schemas/account.schema';
import { useCurrencies, useAddCurrency } from '@/features/currencies/hooks/use-currencies';
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
import { Loader2, Plus } from 'lucide-react';

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [currencyInput, setCurrencyInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: currencies = [], isLoading: isLoadingCurrencies } = useCurrencies();
  const addCurrencyMutation = useAddCurrency();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<CreateAccountFormData>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      starting_balance: 0,
      currency: 'USD',
    },
  });

  const selectedCurrency = watch('currency');

  // Filter currencies based on input
  const filteredCurrencies = useMemo(() => {
    if (!currencyInput) return currencies;
    const search = currencyInput.toUpperCase();
    return currencies.filter(c => c.code.startsWith(search));
  }, [currencies, currencyInput]);

  const handleCurrencySelect = (code: string) => {
    setValue('currency', code);
    setCurrencyInput(code);
    setShowSuggestions(false);
  };

  const handleAddNewCurrency = async () => {
    const code = currencyInput.toUpperCase();
    if (code.length === 3) {
      try {
        await addCurrencyMutation.mutateAsync(code);
        setValue('currency', code);
        setShowSuggestions(false);
      } catch (err) {
        console.error('Failed to add currency:', err);
      }
    }
  };

  const onSubmit = async (data: CreateAccountFormData) => {
    try {
      setError(null);

      // Check if currency exists, if not try to add it (ignore if already exists)
      const currencyExists = currencies.some(c => c.code === data.currency.toUpperCase());
      if (!currencyExists) {
        try {
          await addCurrencyMutation.mutateAsync(data.currency.toUpperCase());
        } catch (currencyError) {
          // Ignore duplicate currency errors - it means it already exists
          console.log('Currency might already exist, continuing with creation');
        }
      }

      await accountsApi.create(data);

      // Invalidate accounts query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['accounts'] });

      // Reset form and close modal
      reset();
      setCurrencyInput('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    }
  };

  const handleClose = () => {
    reset();
    setCurrencyInput('');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
          <DialogDescription>
            Create a new account to track your finances
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
              {error}
            </div>
          )}

          {/* Account Nickname */}
          <div className="space-y-2">
            <Label htmlFor="name">Account Nickname *</Label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., Checking Account, Savings, Cash"
              {...register('name')}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Starting Balance */}
          <div className="space-y-2">
            <Label htmlFor="starting_balance">Starting Balance</Label>
            <Input
              id="starting_balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('starting_balance', { valueAsNumber: true })}
              disabled={isSubmitting}
            />
            {errors.starting_balance && (
              <p className="text-sm text-red-600">{errors.starting_balance.message}</p>
            )}
          </div>

          {/* Currency with Autocomplete */}
          <div className="space-y-2">
            <Label htmlFor="currency">Currency *</Label>
            <div className="relative">
              <Input
                id="currency"
                type="text"
                placeholder="Type to search (e.g., USD, EUR)"
                value={currencyInput}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setCurrencyInput(value);
                  setValue('currency', value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay to allow clicking on suggestions
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                maxLength={3}
                disabled={isSubmitting}
                className="uppercase"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg max-h-60 overflow-auto">
                  {isLoadingCurrencies ? (
                    <div className="p-4 text-center text-sm text-zinc-500">
                      Loading currencies...
                    </div>
                  ) : filteredCurrencies.length > 0 ? (
                    <div className="py-1">
                      {filteredCurrencies.map((currency) => (
                        <button
                          key={currency.id}
                          type="button"
                          onClick={() => handleCurrencySelect(currency.code)}
                          className="w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
                        >
                          {currency.code}
                        </button>
                      ))}
                    </div>
                  ) : currencyInput.length === 3 ? (
                    <button
                      type="button"
                      onClick={handleAddNewCurrency}
                      className="w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add "{currencyInput}" as new currency</span>
                    </button>
                  ) : (
                    <div className="p-4 text-center text-sm text-zinc-500">
                      {currencyInput ? 'No currencies found' : 'Start typing to search'}
                    </div>
                  )}
                </div>
              )}
            </div>
            {errors.currency && (
              <p className="text-sm text-red-600">{errors.currency.message}</p>
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
