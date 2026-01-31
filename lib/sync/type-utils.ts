/**
 * Sync Engine Type Utilities
 *
 * Type-safe utilities for WatermelonDB model callbacks and cents validation.
 *
 * CTO MANDATE: No `any` at sync boundaries - financial data integrity is paramount.
 * All cents fields must be validated as integers before writing to WatermelonDB.
 *
 * @module sync/type-utils
 */

import { z } from 'zod';
import { SchemaValidationError } from '@/lib/data/validate';
import type { SyncStatus } from '@/lib/local-db/schema';

// ============================================================================
// CENTS VALIDATION
// ============================================================================

/**
 * Zod schema for integer cents validation.
 * Reuses existing Data Border Control pattern for consistency.
 */
export const IntegerCentsSchema = z.number().int({
  message: 'Cents must be integer (no decimals)',
});

/**
 * Validate a cents value is a true integer at sync boundary.
 * Uses SchemaValidationError for consistency with existing patterns.
 *
 * CTO MANDATE: All cents fields must be integers at sync boundaries.
 * This catches floating-point values like 100.5 that would corrupt financial data.
 *
 * @param value - Unknown value to validate (will be converted to number first)
 * @param fieldName - Field name for error reporting
 * @returns The validated integer value
 * @throws SchemaValidationError if value is not a finite integer
 */
export function assertIntegerCents(value: unknown, fieldName: string): number {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    throw new SchemaValidationError(
      fieldName,
      [{ code: 'custom', message: 'Invalid number', path: [] }],
      value
    );
  }

  // S-Tier: Use Number.isInteger() for precise check, not threshold-based
  if (!Number.isInteger(num)) {
    throw new SchemaValidationError(
      fieldName,
      [
        {
          code: 'custom',
          message: `Must be integer cents, got float: ${num}`,
          path: [],
        },
      ],
      num
    );
  }

  return num;
}

/**
 * Safely parse cents value, returning null for null/undefined input.
 * For optional cents fields in inbox items.
 *
 * @param value - Unknown value (may be null/undefined)
 * @param fieldName - Field name for error reporting
 * @returns Integer cents or null
 * @throws SchemaValidationError if value is present but not a valid integer
 */
export function assertIntegerCentsOrNull(
  value: unknown,
  fieldName: string
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return assertIntegerCents(value, fieldName);
}

// ============================================================================
// VERSION FIELD ACCESSOR
// ============================================================================

/**
 * Server row with version field (sync-enabled tables)
 */
export interface VersionedRow {
  version?: number;
}

/**
 * Safely extract version from server row.
 *
 * Handles the case where version field may not be in auto-generated Supabase types
 * but exists in the database after sync migrations.
 *
 * @param row - Server row object
 * @returns Version number, defaults to 1 if missing
 */
export function getVersion(row: VersionedRow): number {
  return row.version ?? 1;
}

// ============================================================================
// WATERMELONDB MODEL CALLBACK TYPES
// ============================================================================

/**
 * Base syncable fields present on all synced WatermelonDB models.
 * Used to type the callback parameter in record.update() and collection.create().
 *
 * Maps to schema columns:
 * - local_sync_status (column) → localSyncStatus (model via @field decorator)
 * - version (column) → version (model)
 * - deleted_at (column) → deletedAt (model)
 */
export interface SyncableModelFields {
  /** Maps to local_sync_status column via @field('local_sync_status') */
  localSyncStatus: SyncStatus;
  /** Optimistic concurrency version */
  version: number;
  /** Tombstone timestamp (null = active, number = soft-deleted) */
  deletedAt: number | null;
}

/**
 * Cents fields that require integer validation at sync boundary.
 * Used by buffered update validation in push-engine.
 */
export const CENTS_FIELDS = new Set([
  'amountCents',
  'amountHomeCents',
  'currentBalanceCents',
]);

/**
 * Type guard to check if a field name is a cents field requiring validation.
 */
export function isCentsField(fieldName: string): boolean {
  return CENTS_FIELDS.has(fieldName);
}
