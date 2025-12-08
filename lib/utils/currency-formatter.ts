/**
 * Currency Formatter - Pure Utility Functions
 *
 * Single source of truth for all currency and number formatting.
 * These are pure, testable functions with no React dependencies.
 *
 * WHY: Separates formatting logic from React hooks, making it:
 * - Testable in isolation
 * - Reusable across both hooks and non-React code
 * - Easier to maintain locale and precision logic
 *
 * USAGE:
 * import { formatCurrency, formatCurrencyShort } from '@/lib/utils/currency-formatter';
 * const formatted = formatCurrency(1234.56, 'USD'); // "1,234.56"
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Default locale for number formatting
 * Can be extended to support user-specific locales in the future
 */
const DEFAULT_LOCALE = 'en-US';

/**
 * Number format options for different formatting styles
 */
const FORMAT_OPTIONS = {
  /**
   * Standard currency format with 2 decimal places
   * Example: 1234.56 -> "1,234.56"
   */
  STANDARD: {
    style: 'decimal' as const,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },

  /**
   * Short format with no decimal places (for large numbers)
   * Example: 1234.56 -> "1,235"
   */
  SHORT: {
    style: 'decimal' as const,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },

  /**
   * Compact format for very large numbers
   * Example: 1234567 -> "1.2M"
   */
  COMPACT: {
    style: 'decimal' as const,
    notation: 'compact' as const,
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  },
} as const;

// ============================================================================
// CORE FORMATTING FUNCTIONS
// ============================================================================

/**
 * Formats a number as currency with 2 decimal places
 *
 * @param amount - The numeric amount to format
 * @param currency - Currency code (currently unused, reserved for future locale support)
 * @param locale - Optional locale override (defaults to DEFAULT_LOCALE)
 * @returns Formatted string with thousands separators and 2 decimals
 *
 * @example
 * formatCurrency(1234.56, 'USD') // "1,234.56"
 * formatCurrency(0, 'USD') // "0.00"
 * formatCurrency(-1234.56, 'USD') // "-1,234.56"
 */
export function formatCurrency(
  amount: number,
  currency: string,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, FORMAT_OPTIONS.STANDARD).format(amount);
}

/**
 * Formats a number as currency with no decimal places
 * Useful for displaying large numbers or when precision isn't needed
 *
 * @param amount - The numeric amount to format
 * @param currency - Currency code (currently unused, reserved for future locale support)
 * @param locale - Optional locale override (defaults to DEFAULT_LOCALE)
 * @returns Formatted string with thousands separators, no decimals
 *
 * @example
 * formatCurrencyShort(1234.56, 'USD') // "1,235"
 * formatCurrencyShort(0, 'USD') // "0"
 * formatCurrencyShort(999.4, 'USD') // "999"
 */
export function formatCurrencyShort(
  amount: number,
  currency: string,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, FORMAT_OPTIONS.SHORT).format(amount);
}

/**
 * Formats a number in compact notation for very large numbers
 * Useful for charts, summaries, or space-constrained displays
 *
 * @param amount - The numeric amount to format
 * @param currency - Currency code (currently unused, reserved for future locale support)
 * @param locale - Optional locale override (defaults to DEFAULT_LOCALE)
 * @returns Formatted string in compact notation
 *
 * @example
 * formatCurrencyCompact(1234567, 'USD') // "1.2M"
 * formatCurrencyCompact(1234, 'USD') // "1.2K"
 * formatCurrencyCompact(999, 'USD') // "999"
 */
export function formatCurrencyCompact(
  amount: number,
  currency: string,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, FORMAT_OPTIONS.COMPACT).format(amount);
}

// ============================================================================
// PARSING AND VALIDATION
// ============================================================================

/**
 * Parses a formatted currency string back to a number
 * Handles thousands separators and decimal points
 *
 * @param formattedAmount - Formatted currency string
 * @returns Numeric value or NaN if invalid
 *
 * @example
 * parseCurrency("1,234.56") // 1234.56
 * parseCurrency("1234.56") // 1234.56
 * parseCurrency("invalid") // NaN
 */
export function parseCurrency(formattedAmount: string): number {
  // Remove thousands separators and parse
  const cleaned = formattedAmount.replace(/,/g, '');
  return parseFloat(cleaned);
}

/**
 * Validates if a string is a valid currency format
 *
 * @param value - String to validate
 * @returns true if valid currency format
 *
 * @example
 * isValidCurrencyFormat("1,234.56") // true
 * isValidCurrencyFormat("1234") // true
 * isValidCurrencyFormat("abc") // false
 */
export function isValidCurrencyFormat(value: string): boolean {
  const parsed = parseCurrency(value);
  return !isNaN(parsed) && isFinite(parsed);
}

// ============================================================================
// CURRENCY SYMBOL UTILITIES
// ============================================================================

/**
 * Gets the currency symbol for a given currency code
 *
 * @param currencyCode - ISO 4217 currency code (e.g., "USD", "EUR")
 * @param locale - Optional locale override
 * @returns Currency symbol
 *
 * @example
 * getCurrencySymbol("USD") // "$"
 * getCurrencySymbol("EUR") // "€"
 * getCurrencySymbol("GBP") // "£"
 */
export function getCurrencySymbol(
  currencyCode: string,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value || currencyCode;
}

/**
 * Formats amount with currency symbol
 *
 * @param amount - Numeric amount
 * @param currencyCode - ISO 4217 currency code
 * @param locale - Optional locale override
 * @returns Formatted string with currency symbol
 *
 * @example
 * formatWithSymbol(1234.56, "USD") // "$1,234.56"
 * formatWithSymbol(1234.56, "EUR") // "€1,234.56"
 */
export function formatWithSymbol(
  amount: number,
  currencyCode: string,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Configuration options for currency formatting
 */
export interface CurrencyFormatOptions {
  /** Locale to use for formatting */
  locale?: string;
  /** Whether to include currency symbol */
  includeSymbol?: boolean;
  /** Number of decimal places (defaults based on format) */
  decimals?: number;
}

/**
 * Advanced currency formatter with custom options
 *
 * @param amount - Numeric amount
 * @param currency - Currency code
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrencyAdvanced(
  amount: number,
  currency: string,
  options: CurrencyFormatOptions = {}
): string {
  const {
    locale = DEFAULT_LOCALE,
    includeSymbol = false,
    decimals = 2,
  } = options;

  if (includeSymbol) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  }

  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}
