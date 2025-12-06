import { useMemo } from 'react';

interface TransferCalculation {
  exchangeRate: number;
  isMultiCurrency: boolean;
  displayRate?: string;
  error?: string;
}

/**
 * Calculates implied exchange rate for multi-currency transfers
 * Rate = receivedAmount / sentAmount
 */
export function useTransferCalculation(
  sentAmount: string,
  receivedAmount: string,
  fromCurrency: string | null,
  toCurrency: string | null
): TransferCalculation {
  const calculation = useMemo(() => {
    if (!fromCurrency || !toCurrency) {
      return { exchangeRate: 1, isMultiCurrency: false };
    }

    const isMultiCurrency = fromCurrency !== toCurrency;

    if (!isMultiCurrency) {
      return { exchangeRate: 1, isMultiCurrency: false };
    }

    const sent = parseFloat(sentAmount) || 0;
    const received = parseFloat(receivedAmount) || 0;

    if (sent === 0) {
      return {
        exchangeRate: 1,
        isMultiCurrency: true,
        error: 'Sent amount required',
      };
    }

    const exchangeRate = received / sent;

    return {
      exchangeRate,
      isMultiCurrency: true,
      displayRate: `1 ${fromCurrency} = ${exchangeRate.toFixed(4)} ${toCurrency}`,
    };
  }, [sentAmount, receivedAmount, fromCurrency, toCurrency]);

  return calculation;
}
