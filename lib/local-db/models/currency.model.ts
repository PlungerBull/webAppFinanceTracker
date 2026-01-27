/**
 * WatermelonDB Currency Model
 *
 * Mirrors global_currencies table from Supabase.
 * Read-only reference table - data is pulled from server.
 *
 * CTO MANDATE: This table is read-only and does not participate
 * in the bidirectional sync. It's populated from server data only.
 *
 * @module local-db/models/currency
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';
import type { Currency } from '@/types/domain';

/**
 * WatermelonDB Currency Model
 *
 * Maps to global_currencies table.
 * Read-only reference for currency metadata.
 */
export class CurrencyModel extends Model {
  static table = 'global_currencies';

  // Core fields (read-only reference data)
  @field('code') code!: string; // Primary identifier (e.g., "USD")
  @field('name') name!: string; // Full name (e.g., "US Dollar")
  @field('symbol') symbol!: string; // Symbol (e.g., "$")
  @field('flag') flag!: string | null; // Emoji flag (e.g., "🇺🇸")

  // Last update timestamp
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Convert to domain entity for compatibility with existing code
   */
  toDomainEntity(): Currency {
    return {
      code: this.code,
      name: this.name,
      symbol: this.symbol,
      flag: this.flag,
    };
  }
}
