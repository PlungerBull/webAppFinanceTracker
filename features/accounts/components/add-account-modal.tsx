'use client';

'use client';

import { useFormModal } from '@/hooks/shared/use-form-modal';
import { useCurrencyManager } from '@/hooks/use-currency-manager';
import { useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import { CURRENCY, VALIDATION, QUERY_KEYS, ACCOUNT, ACCOUNTS, ACCOUNT_UI } from '@/lib/constants';
import { AccountForm } from './account-form';
import { FormModal } from '@/components/shared/form-modal';

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
    currencyInput,
    balanceInput,
    showSuggestions,
    isLoadingCurrencies,
    setCurrencyInput,
    setBalanceInput,
    setShowSuggestions,
    filteredCurrencies,
    handleAddCurrency,
    handleRemoveCurrency,
    handleUpdateBalance,
    resetCurrencies,
  } = useCurrencyManager();

  const onSubmit = async (data: AccountFormData) => {
    // Validation: At least one currency must be selected
    if (selectedCurrencies.length === 0) {
      throw new Error(ACCOUNT_UI.MESSAGES.AT_LEAST_ONE_CURRENCY);
    }

    // ✅ NEW: Use atomic database function instead of two separate operations
    // This guarantees either everything is created or nothing is created
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

  return (
    <FormModal
      open={open}
      onOpenChange={handleClose}
      title={ACCOUNT_UI.LABELS.CREATE_ACCOUNT}
      description={ACCOUNT_UI.DESCRIPTIONS.CREATE_ACCOUNT}
      onSubmit={(e) => void handleSubmit(e)}
      isSubmitting={isSubmitting}
      submitLabel={ACCOUNT_UI.BUTTONS.CREATE}
      cancelLabel={ACCOUNT_UI.BUTTONS.CANCEL}
      error={error}
      maxWidth="sm:max-w-[550px]"
    >
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
        <Label htmlFor="currency">{ACCOUNT_UI.LABELS.CURRENCY}</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="currency-input"
              name="currency"
              type="text"
              placeholder={ACCOUNT_UI.LABELS.CURRENCY_PLACEHOLDER}
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
                    {ACCOUNT_UI.MESSAGES.LOADING}
                  </div>
                ) : filteredCurrencies.length > 0 ? (
                  <div className="py-1">
                    {filteredCurrencies.map((currency) => (
                      <button
                        key={currency.code}
                        type="button"
                        onClick={() => handleAddCurrency(currency.code)}
                        className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {currency.flag && <span>{currency.flag}</span>}
                          <span className="font-medium">{currency.code}</span>
                          <span className="text-muted-foreground text-xs">- {currency.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-sm text-zinc-500">
                    No matching currencies found
                  </div>
                )}
              </div>
            )}
          </div>

          <Input
            id="balance-input"
            name="balance"
            type="number"
            step={CURRENCY.STEP.STANDARD}
            placeholder={ACCOUNT_UI.LABELS.BALANCE}
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            disabled={isSubmitting}
            className="w-32"
            autoComplete="off"
            aria-label={ACCOUNT_UI.LABELS.STARTING_BALANCE}
          />
        </div>
        <p className="text-xs text-zinc-500">
          {ACCOUNT_UI.DESCRIPTIONS.ADD_CURRENCIES}
        </p>
      </div>

      {/* Selected Currencies List */}
      {
        selectedCurrencies.length > 0 && (
          <div className="space-y-2">
            <Label>{ACCOUNT_UI.LABELS.SELECTED_CURRENCIES(selectedCurrencies.length)}</Label>
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
                    aria-label={ACCOUNT_UI.LABELS.STARTING_BALANCE_FOR(currency.currency_code)}
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
        )
      }
    </FormModal >
  );
}