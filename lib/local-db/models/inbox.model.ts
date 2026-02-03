/**
 * WatermelonDB Inbox Model
 *
 * Mirrors transaction_inbox table from Supabase.
 * Staging area for incomplete transactions.
 *
 * CTO MANDATES:
 * - ID Mirror Strategy: WatermelonDB `id` = Supabase UUID
 * - Integer Cents: amount_cents is integer
 * - Version Sync: version field for optimistic concurrency
 *
 * @module local-db/models/inbox
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';
import type { InboxItemEntity } from '@/domain/inbox';
import type { SyncStatus } from '../schema';
import type { AccountModel } from './account.model';
import type { CategoryModel } from './category.model';

/**
 * Inbox status enum matching database constraint
 */
export type InboxStatus = 'pending' | 'processed' | 'ignored';

/**
 * WatermelonDB Inbox Model
 *
 * Maps to transaction_inbox table.
 * Represents "dirty" transactions awaiting review.
 */
export class InboxModel extends Model {
  static table = 'transaction_inbox';

  static associations = {
    bank_accounts: { type: 'belongs_to' as const, key: 'account_id' },
    categories: { type: 'belongs_to' as const, key: 'category_id' },
  };

  // Core fields
  @field('user_id') userId!: string;
  @field('amount_cents') amountCents!: number | null; // INTEGER CENTS (nullable for drafts)
  @field('description') description!: string | null;
  @date('date') date!: Date | null;
  @field('source_text') sourceText!: string | null;
  @field('account_id') accountId!: string | null;
  @field('category_id') categoryId!: string | null;
  @field('exchange_rate') exchangeRate!: number | null;
  @field('notes') notes!: string | null;
  @field('status') status!: InboxStatus;

  // Sync fields
  @field('version') version!: number;
  @field('deleted_at') deletedAt!: number | null;
  @field('local_sync_status') localSyncStatus!: SyncStatus;
  @field('sync_error') syncError!: string | null;

  // Timestamps (readonly - managed by WatermelonDB)
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // Relations (for lazy loading)
  @relation('bank_accounts', 'account_id') account!: AccountModel | null;
  @relation('categories', 'category_id') category!: CategoryModel | null;

  /**
   * Check if item is ready for promotion to ledger
   */
  get isPromotionReady(): boolean {
    return (
      this.amountCents !== null &&
      this.accountId !== null &&
      this.categoryId !== null
    );
  }

  /**
   * Convert to domain entity for compatibility with existing code
   *
   * CTO MANDATE: Math.round() on cents fields eliminates floating-point "dust"
   * that can accumulate during JavaScript arithmetic operations.
   */
  toDomainEntity(): InboxItemEntity {
    return {
      id: this.id,
      userId: this.userId,
      // CTO: Eliminate floating-point dust (handle nullable)
      amountCents: this.amountCents !== null ? Math.round(this.amountCents) : null,
      currencyCode: null, // Populated via join
      description: this.description,
      date: this.date?.toISOString() ?? null,
      sourceText: this.sourceText,
      accountId: this.accountId,
      categoryId: this.categoryId,
      exchangeRate: this.exchangeRate,
      notes: this.notes,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      version: this.version,
      deletedAt: this.deletedAt ? new Date(this.deletedAt).toISOString() : null,
    };
  }
}
