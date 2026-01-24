/**
 * Cents Parser - String-Based Currency Conversion
 *
 * CTO MANDATE: No Floating-Point Math for Currency
 * JavaScript floats can produce drift: 1.15 * 100 = 114.99999999999999
 *
 * This utility treats currency input as a STRING and performs integer-only
 * arithmetic to convert to cents. This is the "Sacred" approach for financial apps.
 *
 * @module cents-parser
 */

/**
 * Parse a currency string to integer cents WITHOUT floating-point multiplication.
 *
 * Algorithm:
 * 1. Split on decimal point
 * 2. Pad/truncate cents portion to exactly 2 digits
 * 3. Concatenate as string
 * 4. Parse as integer
 *
 * Examples:
 * - "10.50" → 1050
 * - "10.5"  → 1050 (pads to 2 digits)
 * - "10"    → 1000
 * - "-5.25" → -525
 * - "1.999" → 199 (truncates to 2 digits, no rounding - user input error)
 *
 * @param value - Currency string (e.g., "10.50", "-5.25", "100")
 * @returns Integer cents
 * @throws Error if value is not a valid currency format
 */
export function parseCurrencyToCents(value: string): number {
  // Trim whitespace
  const trimmed = value.trim();

  if (trimmed === '' || trimmed === '-') {
    throw new Error('parseCurrencyToCents: empty or invalid input');
  }

  // Handle negative sign
  const isNegative = trimmed.startsWith('-');
  const absolute = isNegative ? trimmed.slice(1) : trimmed;

  // Validate: only digits and at most one decimal point
  if (!/^\d+(\.\d*)?$/.test(absolute)) {
    throw new Error(`parseCurrencyToCents: invalid format "${value}"`);
  }

  // Split on decimal
  const parts = absolute.split('.');
  const wholePart = parts[0] || '0';
  let centsPart = parts[1] || '';

  // Pad or truncate cents to exactly 2 digits
  if (centsPart.length === 0) {
    centsPart = '00';
  } else if (centsPart.length === 1) {
    centsPart = centsPart + '0';
  } else if (centsPart.length > 2) {
    // Truncate to 2 digits (no rounding - matches bank behavior)
    centsPart = centsPart.slice(0, 2);
  }

  // Concatenate and parse as integer
  const centsString = wholePart + centsPart;
  const cents = parseInt(centsString, 10);

  if (isNaN(cents)) {
    throw new Error(`parseCurrencyToCents: failed to parse "${value}"`);
  }

  return isNegative ? -cents : cents;
}

/**
 * Parse a currency number to integer cents WITHOUT floating-point multiplication.
 *
 * This handles the case where the UI has already parsed a string to a number.
 * We convert back to string first to avoid float math.
 *
 * CRITICAL: This is the ONLY safe way to convert displayAmount (number) to cents.
 *
 * @param value - Currency as number (e.g., 10.50, -5.25)
 * @returns Integer cents
 */
export function displayAmountToCents(value: number): number {
  // Convert to string with fixed 2 decimal places to normalize representation
  // This handles cases like 10.5 → "10.50"
  const str = value.toFixed(2);
  return parseCurrencyToCents(str);
}

/**
 * Convert integer cents to display amount (dollars).
 *
 * This is the reverse operation and IS safe to use division because:
 * 1. cents is already an integer
 * 2. Division by 100 produces at most 2 decimal places
 * 3. JavaScript can represent X.YY exactly for reasonable values
 *
 * @param cents - Integer cents (e.g., 1050)
 * @returns Display amount in dollars (e.g., 10.50)
 */
export function centsToDisplayAmount(cents: number): number {
  return cents / 100;
}

/**
 * Format integer cents as a currency string for display.
 *
 * @param cents - Integer cents (e.g., 1050)
 * @param currencyCode - Optional currency code (e.g., "USD", "PEN")
 * @returns Formatted string (e.g., "10.50" or "10.50 USD")
 */
export function formatCents(cents: number, currencyCode?: string | null): string {
  const amount = (cents / 100).toFixed(2);
  return currencyCode ? `${amount} ${currencyCode}` : amount;
}
