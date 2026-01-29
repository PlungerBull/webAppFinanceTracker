import { useMemo } from 'react';
import { parseCurrencyToCents } from '@/lib/utils/cents-parser';

interface TransferCalculation {
  exchangeRate: number;
  isMultiCurrency: boolean;
  displayRate?: string;
  error?: string;
}

/**
 * Calculates implied exchange rate for multi-currency transfers
 * Rate = receivedAmount / sentAmount
 *
 * Uses string-based cents parsing to avoid IEEE 754 floating-point errors
 * that would occur with parseFloat().
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

    // Parse to cents using string-based method to avoid float contamination
    // parseCurrencyToCents throws on invalid input, so we handle gracefully
    let sentCents: number;
    let receivedCents: number;
    try {
      sentCents = parseCurrencyToCents(sentAmount || '0');
      receivedCents = parseCurrencyToCents(receivedAmount || '0');
    } catch {
      sentCents = 0;
      receivedCents = 0;
    }

    if (sentCents === 0) {
      return {
        exchangeRate: 1,
        isMultiCurrency: true,
        error: 'Sent amount required',
      };
    }

    // Integer division produces cleaner result than float division
    // receivedCents / sentCents = (received * 100) / (sent * 100) = received / sent
    const exchangeRate = receivedCents / sentCents;

    return {
      exchangeRate,
      isMultiCurrency: true,
      // Display with 6 decimals to match database NUMERIC(15,6) precision
      displayRate: `1 ${fromCurrency} = ${exchangeRate.toFixed(6)} ${toCurrency}`,
    };
  }, [sentAmount, receivedAmount, fromCurrency, toCurrency]);

  return calculation;
}
