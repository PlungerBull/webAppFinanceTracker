/**
 * WatermelonDB Account Model
 *
 * Mirrors bank_accounts table from Supabase.
 *
 * CTO MANDATES:
 * - ID Mirror Strategy: WatermelonDB `id` = Supabase UUID
 * - Integer Cents: current_balance_cents is integer
 * - Version Sync: version field for optimistic concurrency
 *
 * @module local-db/models/account
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';
import type { Account } from '@/types/domain';
import type { SyncStatus } from '../schema';

/**
 * Account type enum matching database constraint
 */
export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'investment'
  | 'loan'
  | 'cash'
  | 'other';

/**
 * WatermelonDB Account Model
 *
 * Maps to bank_accounts table.
 * Uses decorators for field bindings.
 */
export class AccountModel extends Model {
  static table = 'bank_accounts';

  // Core fields
  @field('group_id') groupId!: string;
  @field('user_id') userId!: string;
  @field('name') name!: string;
  @field('type') type!: AccountType;
  @field('currency_code') currencyCode!: string;
  @field('color') color!: string;
  @field('is_visible') isVisible!: boolean;
  @field('current_balance_cents') currentBalanceCents!: number;

  // Sync fields
  @field('version') version!: number;
  @field('deleted_at') deletedAt!: number | null;
  @field('local_sync_status') localSyncStatus!: SyncStatus;
  @field('sync_error') syncError!: string | null;

  // Timestamps (readonly - managed by WatermelonDB)
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Convert to domain entity for compatibility with existing code
   *
   * CTO MANDATE: Domain types use camelCase, WatermelonDB uses snake_case internally
   */
  toDomainEntity(): Account {
    return {
      id: this.id, // WatermelonDB id = Supabase UUID
      version: this.version,
      groupId: this.groupId,
      name: this.name,
      color: this.color,
      currencyCode: this.currencyCode,
      type: this.type,
      userId: this.userId,
      isVisible: this.isVisible,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      deletedAt: this.deletedAt ? new Date(this.deletedAt).toISOString() : null,
    };
  }
}
