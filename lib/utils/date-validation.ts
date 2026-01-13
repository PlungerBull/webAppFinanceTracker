/**
 * Date Validation Utilities
 *
 * CTO Mandate #4: Strict ISO 8601 Date Enforcement
 *
 * Problem: JavaScript's `new Date()` is forgiving. Swift's `ISO8601DateFormatter`
 *          crashes on malformed dates.
 * Solution: Repository layer MUST enforce strict `YYYY-MM-DDTHH:mm:ss.SSSZ` format.
 *
 * Cross-Platform Compatibility:
 * - TypeScript: Uses this utility for validation
 * - Swift: Uses ISO8601DateFormatter with strict parsing
 *
 * @module date-validation
 */

/**
 * Converts a Date or string to strict ISO 8601 format.
 *
 * Format: YYYY-MM-DDTHH:mm:ss.SSSZ
 * Example: "2024-01-12T10:30:00.123Z"
 *
 * This format is:
 * - Cross-platform compatible (TypeScript + Swift)
 * - Always includes milliseconds (.SSS)
 * - Always UTC (Z suffix)
 * - Deterministic (no timezone ambiguity)
 *
 * @param date - Date object or ISO string
 * @returns Strict ISO 8601 string
 * @throws {Error} If date is invalid
 *
 * @example
 * ```typescript
 * toStrictISO(new Date()) // "2024-01-12T10:30:00.123Z"
 * toStrictISO("2024-01-12") // "2024-01-12T00:00:00.000Z"
 * toStrictISO("invalid") // throws Error
 * ```
 */
export function toStrictISO(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }

  // Force strict format (always include milliseconds and Z)
  // Date.prototype.toISOString() already returns this format
  return d.toISOString();
}

/**
 * Validates an ISO 8601 date string against strict format.
 *
 * Format: YYYY-MM-DDTHH:mm:ss.SSSZ
 *
 * Why strict validation?
 * - Prevents Swift ISO8601DateFormatter crashes
 * - Ensures consistent format across platforms
 * - Catches common mistakes (missing milliseconds, missing Z, etc.)
 *
 * @param dateString - ISO 8601 string to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * validateISODate("2024-01-12T10:30:00.123Z") // true
 * validateISODate("2024-01-12T10:30:00Z") // false (missing milliseconds)
 * validateISODate("2024-01-12T10:30:00.123") // false (missing Z)
 * validateISODate("2024-01-12") // false (not full ISO 8601)
 * ```
 */
export function validateISODate(dateString: string): boolean {
  // Strict regex: YYYY-MM-DDTHH:mm:ss.SSSZ
  // - YYYY: 4-digit year
  // - MM: 2-digit month (01-12)
  // - DD: 2-digit day (01-31)
  // - T: literal "T" separator
  // - HH: 2-digit hour (00-23)
  // - mm: 2-digit minute (00-59)
  // - ss: 2-digit second (00-59)
  // - .SSS: 3-digit milliseconds (required!)
  // - Z: literal "Z" (UTC timezone)
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  if (!isoRegex.test(dateString)) {
    return false;
  }

  // Validate that it's a real date (not "2024-13-40")
  const d = new Date(dateString);
  return !isNaN(d.getTime());
}

/**
 * Gets the current timestamp in strict ISO 8601 format.
 *
 * Convenience function for common use case.
 *
 * @returns Current timestamp as strict ISO 8601 string
 *
 * @example
 * ```typescript
 * const now = nowStrictISO(); // "2024-01-12T10:30:00.123Z"
 * ```
 */
export function nowStrictISO(): string {
  return new Date().toISOString();
}

/**
 * Swift Mirror Code (for iOS team reference)
 *
 * ```swift
 * import Foundation
 *
 * // Strict ISO 8601 formatter
 * extension ISO8601DateFormatter {
 *     static let strict: ISO8601DateFormatter = {
 *         let formatter = ISO8601DateFormatter()
 *         formatter.formatOptions = [
 *             .withInternetDateTime,
 *             .withFractionalSeconds
 *         ]
 *         return formatter
 *     }()
 * }
 *
 * // Convert to strict ISO string
 * func toStrictISO(date: Date) -> String {
 *     return ISO8601DateFormatter.strict.string(from: date)
 * }
 *
 * // Validate ISO date string
 * func validateISODate(dateString: String) -> Bool {
 *     let regex = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"
 *     let predicate = NSPredicate(format: "SELF MATCHES %@", regex)
 *
 *     guard predicate.evaluate(with: dateString) else {
 *         return false
 *     }
 *
 *     // Validate it's a real date
 *     return ISO8601DateFormatter.strict.date(from: dateString) != nil
 * }
 *
 * // Get current timestamp
 * func nowStrictISO() -> String {
 *     return ISO8601DateFormatter.strict.string(from: Date())
 * }
 * ```
 */
