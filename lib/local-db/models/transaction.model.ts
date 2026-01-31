/**
 * WatermelonDB Transaction Model
 *
 * Mirrors transactions table from Supabase.
 *
 * CTO MANDATES:
 * - ID Mirror Strategy: WatermelonDB `id` = Supabase UUID
 * - Integer Cents: amount_cents and amount_home_cents are integers
 * - Version Sync: version field for optimistic concurrency
 *
 * @module local-db/models/transaction
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';
import type { Transaction } from '@/types/domain';
import type { SyncStatus } from '../schema';
import type { AccountModel } from './account.model';
import type { CategoryModel } from './category.model';

/**
 * WatermelonDB Transaction Model
 *
 * Maps to transactions table.
 * Uses decorators for field bindings.
 */
export class TransactionModel extends Model {
  static table = 'transactions';

  static associations = {
    bank_accounts: { type: 'belongs_to' as const, key: 'account_id' },
    categories: { type: 'belongs_to' as const, key: 'category_id' },
  };

  // Core fields
  @field('user_id') userId!: string;
  @field('account_id') accountId!: string;
  @field('category_id') categoryId!: string | null;
  @field('amount_cents') amountCents!: number; // INTEGER CENTS
  @field('amount_home_cents') amountHomeCents!: number; // INTEGER CENTS
  @field('exchange_rate') exchangeRate!: number;
  @date('date') date!: Date;
  @field('description') description!: string | null;
  @field('notes') notes!: string | null;
  @field('source_text') sourceText!: string | null;
  @field('transfer_id') transferId!: string | null;
  @field('inbox_id') inboxId!: string | null;
  @field('cleared') cleared!: boolean;
  @field('reconciliation_id') reconciliationId!: string | null;

  // Sync fields
  @field('version') version!: number;
  @field('deleted_at') deletedAt!: number | null;
  @field('local_sync_status') localSyncStatus!: SyncStatus;

  // Timestamps (readonly - managed by WatermelonDB)
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // Relations (for lazy loading)
  @relation('bank_accounts', 'account_id') account!: AccountModel;
  @relation('categories', 'category_id') category!: CategoryModel | null;

  /**
   * Convert to domain entity for compatibility with existing code
   *
   * CTO MANDATE: Math.round() on cents fields eliminates floating-point "dust"
   * that can accumulate during JavaScript arithmetic operations.
   */
  toDomainEntity(): Transaction {
    return {
      id: this.id,
      version: this.version,
      userId: this.userId,
      accountId: this.accountId,
      categoryId: this.categoryId,
      amountCents: Math.round(this.amountCents), // CTO: Eliminate floating-point dust
      amountHomeCents: Math.round(this.amountHomeCents), // CTO: Eliminate floating-point dust
      currencyOriginal: null, // Will be populated via join in repository
      exchangeRate: this.exchangeRate,
      description: this.description,
      notes: this.notes,
      sourceText: this.sourceText ?? undefined,
      date: this.date.toISOString(),
      transferId: this.transferId,
      inboxId: this.inboxId ?? undefined,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
