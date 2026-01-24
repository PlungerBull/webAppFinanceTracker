/**
 * BigInt Safety Utility
 *
 * Safe conversion between PostgreSQL BIGINT and JavaScript number.
 *
 * CTO MANDATE: BigInt Precision Safety
 * PostgreSQL BIGINT can hold values up to 9,223,372,036,854,775,807
 * JavaScript Number.MAX_SAFE_INTEGER is 9,007,199,254,740,991
 *
 * For financial applications using integer cents:
 * - MAX_SAFE_INTEGER = $90,071,992,547,409.91 (~90 trillion dollars)
 * - This is sufficient for all practical use cases
 * - But we still validate and throw if exceeded
 *
 * @module bigint-safety
 */

/**
 * Maximum safe integer for JavaScript (2^53 - 1)
 */
export const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
export const MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;

/**
 * Maximum safe value in dollars (when using integer cents)
 * $90,071,992,547,409.91
 */
export const MAX_SAFE_DOLLARS = MAX_SAFE_INTEGER / 100;

/**
 * Convert PostgreSQL BIGINT to safe JavaScript number
 *
 * Supabase returns BIGINT as string to avoid precision loss.
 * This function validates the value is within JavaScript's safe integer range.
 *
 * @param value - The BIGINT value from Supabase (string, number, or null)
 * @returns Safe integer number, or null if input is null
 * @throws Error if value exceeds MAX_SAFE_INTEGER (data integrity failure)
 *
 * CTO MANDATE: Fail loudly on precision loss - no silent truncation
 */
export function toSafeInteger(value: string | number | bigint | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  let numValue: number;

  if (typeof value === 'bigint') {
    // BigInt literal - check before conversion
    if (value > BigInt(MAX_SAFE_INTEGER) || value < BigInt(MIN_SAFE_INTEGER)) {
      throw new Error(
        `BIGINT precision loss: ${value} exceeds JavaScript safe integer range ` +
        `(${MIN_SAFE_INTEGER} to ${MAX_SAFE_INTEGER}). ` +
        `This is a data integrity failure - value cannot be safely represented.`
      );
    }
    numValue = Number(value);
  } else if (typeof value === 'string') {
    // String from Supabase - parse and validate
    numValue = Number(value);
    if (isNaN(numValue)) {
      throw new Error(`BIGINT parse error: "${value}" is not a valid number`);
    }
  } else {
    // Already a number
    numValue = value;
  }

  // Validate safe integer range
  if (!Number.isSafeInteger(numValue)) {
    if (numValue > MAX_SAFE_INTEGER || numValue < MIN_SAFE_INTEGER) {
      throw new Error(
        `BIGINT precision loss: ${numValue} exceeds JavaScript safe integer range ` +
        `(${MIN_SAFE_INTEGER} to ${MAX_SAFE_INTEGER}). ` +
        `This is a data integrity failure - value cannot be safely represented.`
      );
    }
    // Non-integer but within range (e.g., 1050.5)
    throw new Error(
      `BIGINT integrity error: ${numValue} is not an integer. ` +
      `INTEGER CENTS must be whole numbers.`
    );
  }

  return numValue;
}

/**
 * Convert PostgreSQL BIGINT to safe JavaScript number, with zero fallback
 *
 * Same as toSafeInteger but returns 0 instead of null.
 * Use this for amounts that default to zero (e.g., account balances).
 *
 * @param value - The BIGINT value from Supabase
 * @returns Safe integer number (0 if null)
 * @throws Error if value exceeds MAX_SAFE_INTEGER
 */
export function toSafeIntegerOrZero(value: string | number | bigint | null | undefined): number {
  return toSafeInteger(value) ?? 0;
}

/**
 * Validate a number is within safe BIGINT range for database storage
 *
 * Use this before sending values to the database to ensure they'll
 * be retrievable without precision loss.
 *
 * @param value - The number to validate
 * @returns true if value is safe for BIGINT storage
 */
export function isSafeForBigInt(value: number): boolean {
  return Number.isSafeInteger(value);
}

/**
 * Assert a number is within safe BIGINT range
 *
 * @param value - The number to validate
 * @param context - Description of the value for error message
 * @throws Error if value is not safe for BIGINT
 */
export function assertSafeForBigInt(value: number, context: string): void {
  if (!isSafeForBigInt(value)) {
    throw new Error(
      `${context}: ${value} is not safe for BIGINT storage. ` +
      `Value must be an integer within safe range ` +
      `(${MIN_SAFE_INTEGER} to ${MAX_SAFE_INTEGER}).`
    );
  }
}
