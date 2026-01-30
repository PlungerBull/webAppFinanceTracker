/**
 * Cents Conversion Utility — Single Source of Truth
 *
 * Float-safe conversion between decimal dollars and integer cents.
 *
 * CTO MANDATE: Sacred Integer Arithmetic
 * - Binary float: 1.15 * 100 can yield 114.99999999999999
 * - This utility uses string-based parsing to avoid IEEE 754 errors
 * - Every financial calculation in the app (Web + iOS) must use this
 *
 * @module cents-conversion
 */

/**
 * Convert decimal dollars to integer cents (floating-point safe)
 *
 * Uses string-based parsing — NO binary float multiplication.
 * Splits at the decimal point and performs pure integer arithmetic.
 *
 * @param decimal - Dollar amount as string, number, or null
 * @returns Integer cents (0 if null/undefined)
 *
 * @example
 * toCents('10.50')  // 1050
 * toCents(10.50)    // 1050
 * toCents('-1.15')  // -115
 * toCents(null)     // 0
 * toCents('0.005')  // 1 (rounds third digit)
 */
export function toCents(decimal: number | string | null | undefined): number {
  if (decimal === null || decimal === undefined) {
    return 0;
  }

  const str = typeof decimal === 'string' ? decimal : decimal.toString();

  // Handle negative numbers
  const isNegative = str.startsWith('-');
  const absStr = isNegative ? str.slice(1) : str;

  // Split at decimal point
  const parts = absStr.split('.');
  const wholePart = parts[0] || '0';
  let fractionalPart = parts[1] || '00';

  // Normalize fractional part to exactly 2 digits
  if (fractionalPart.length === 1) {
    fractionalPart = fractionalPart + '0';
  } else if (fractionalPart.length > 2) {
    // Round the third digit
    const thirdDigit = parseInt(fractionalPart[2], 10);
    let cents = parseInt(fractionalPart.slice(0, 2), 10);
    if (thirdDigit >= 5) {
      cents += 1;
    }
    fractionalPart = cents.toString().padStart(2, '0');
  }

  // Pure integer arithmetic: whole dollars * 100 + cents
  const cents = parseInt(wholePart, 10) * 100 + parseInt(fractionalPart, 10);

  return isNegative ? -cents : cents;
}

/**
 * Convert integer cents to decimal dollars
 *
 * @param cents - Integer cents
 * @returns Decimal dollar amount
 *
 * @example
 * fromCents(1050)  // 10.5
 * fromCents(100)   // 1
 * fromCents(1)     // 0.01
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Format integer cents as display string with 2 decimal places
 *
 * CTO MANDATE: Single source of truth for cents → display conversion.
 * Use this for all UI display of monetary amounts stored as integer cents.
 *
 * @param cents - Integer cents (or null)
 * @returns Formatted string with 2 decimal places (e.g., "10.50")
 *
 * @example
 * formatCents(1050)   // "10.50"
 * formatCents(100)    // "1.00"
 * formatCents(1)      // "0.01"
 * formatCents(-1050)  // "-10.50"
 * formatCents(null)   // "0.00"
 */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return '0.00';
  }
  return (cents / 100).toFixed(2);
}
