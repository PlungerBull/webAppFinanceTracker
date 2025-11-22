import { useState, useMemo, useCallback } from 'react';
import { useCurrencies } from '@/features/currencies/hooks/use-currencies';
import { useAddCurrency } from '@/features/currencies/hooks/use-add-currency';

/**
 * Currency balance type for managing currencies in account forms
 */
export type CurrencyBalance = {
  currency_code: string;
  starting_balance: number;
};

/**
 * Hook for managing currency selection and balances in account forms
 * Extracts currency management logic from add-account-modal and edit-account-modal
 *
 * @param initialCurrencies - Optional initial currencies to populate
 * @returns Currency management state and handlers
 *
 * @example
 * ```tsx
 * const {
 *   selectedCurrencies,
 *   currencyInput,
 *   setCurrencyInput,
 *   balanceInput,
 *   setBalanceInput,
 *   handleAddCurrency,
 *   handleRemoveCurrency,
 *   handleUpdateBalance,
 *   filteredCurrencies,
 * } = useCurrencyManager();
 * ```
 */
export function useCurrencyManager(initialCurrencies: CurrencyBalance[] = []) {
  const [currencyInput, setCurrencyInput] = useState('');
  const [balanceInput, setBalanceInput] = useState('0');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCurrencies, setSelectedCurrencies] = useState<CurrencyBalance[]>(initialCurrencies);

  const { data: currencies = [], isLoading: isLoadingCurrencies } = useCurrencies();
  const addCurrencyMutation = useAddCurrency();

  /**
   * Filter currencies based on input and exclude already selected ones
   */
  const filteredCurrencies = useMemo(() => {
    if (!currencyInput) return currencies;
    const search = currencyInput.toUpperCase();
    const selectedCodes = selectedCurrencies.map((c) => c.currency_code);
    return currencies.filter(
      (c) => c.code.startsWith(search) && !selectedCodes.includes(c.code)
    );
  }, [currencies, currencyInput, selectedCurrencies]);

  /**
   * Add a currency to the selected list
   */
  const handleAddCurrency = useCallback(
    async (code: string) => {
      // Check if currency already selected in this form
      if (selectedCurrencies.some((c) => c.currency_code === code)) {
        return;
      }

      // Let the API handle duplicates gracefully with upsert
      await addCurrencyMutation.mutateAsync(code);

      // Add to selected currencies
      setSelectedCurrencies([
        ...selectedCurrencies,
        { currency_code: code, starting_balance: parseFloat(balanceInput) || 0 },
      ]);

      // Reset inputs
      setCurrencyInput('');
      setBalanceInput('0');
      setShowSuggestions(false);
    },
    [selectedCurrencies, balanceInput, addCurrencyMutation]
  );

  /**
   * Remove a currency from the selected list
   */
  const handleRemoveCurrency = useCallback(
    (code: string) => {
      setSelectedCurrencies(selectedCurrencies.filter((c) => c.currency_code !== code));
    },
    [selectedCurrencies]
  );

  /**
   * Update the balance for a specific currency
   */
  const handleUpdateBalance = useCallback(
    (code: string, balance: number) => {
      setSelectedCurrencies(
        selectedCurrencies.map((c) =>
          c.currency_code === code ? { ...c, starting_balance: balance } : c
        )
      );
    },
    [selectedCurrencies]
  );

  /**
   * Reset all currency-related state
   */
  const resetCurrencies = useCallback(() => {
    setSelectedCurrencies([]);
    setCurrencyInput('');
    setBalanceInput('0');
    setShowSuggestions(false);
  }, []);

  /**
   * Set multiple currencies at once (useful for edit mode)
   */
  const setSelectedCurrenciesDirectly = useCallback((currencies: CurrencyBalance[]) => {
    setSelectedCurrencies(currencies);
  }, []);

  return {
    // State
    selectedCurrencies,
    currencyInput,
    balanceInput,
    showSuggestions,
    isLoadingCurrencies,

    // Setters
    setCurrencyInput,
    setBalanceInput,
    setShowSuggestions,
    setSelectedCurrenciesDirectly,

    // Computed
    filteredCurrencies,

    // Handlers
    handleAddCurrency,
    handleRemoveCurrency,
    handleUpdateBalance,
    resetCurrencies,
  };
}

/**
 * Return type for useCurrencyManager hook
 */
export type UseCurrencyManagerReturn = {
  selectedCurrencies: CurrencyBalance[];
  currencyInput: string;
  balanceInput: string;
  showSuggestions: boolean;
  isLoadingCurrencies: boolean;
  setCurrencyInput: (value: string) => void;
  setBalanceInput: (value: string) => void;
  setShowSuggestions: (value: boolean) => void;
  setSelectedCurrenciesDirectly: (currencies: CurrencyBalance[]) => void;
  filteredCurrencies: Array<{ code: string; id?: string }>;
  handleAddCurrency: (code: string) => Promise<void>;
  handleRemoveCurrency: (code: string) => void;
  handleUpdateBalance: (code: string, balance: number) => void;
  resetCurrencies: () => void;
};
