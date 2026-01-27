/**
 * WatermelonDB Models Index
 *
 * Central export for all WatermelonDB models.
 * Import models from this file rather than individual model files.
 *
 * @module local-db/models
 */

// Import model classes for array construction
import { AccountModel } from './account.model';
import { TransactionModel } from './transaction.model';
import { CategoryModel } from './category.model';
import { InboxModel } from './inbox.model';
import { CurrencyModel } from './currency.model';
import { SyncMetadataModel } from './sync-metadata.model';

// Re-export model classes
export { AccountModel } from './account.model';
export type { AccountType } from './account.model';

export { TransactionModel } from './transaction.model';

export { CategoryModel } from './category.model';
export type { CategoryType } from './category.model';

export { InboxModel } from './inbox.model';
export type { InboxStatus } from './inbox.model';

export { CurrencyModel } from './currency.model';

export { SyncMetadataModel } from './sync-metadata.model';
export type { SyncMetadataEntity } from './sync-metadata.model';

/**
 * All model classes array
 *
 * Used when initializing WatermelonDB database.
 * Order doesn't matter for WatermelonDB.
 */
export const modelClasses = [
  AccountModel,
  TransactionModel,
  CategoryModel,
  InboxModel,
  CurrencyModel,
  SyncMetadataModel,
] as const;
