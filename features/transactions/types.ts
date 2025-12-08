/**
 * Transaction feature types - Exported from centralized domain types
 *
 * DEPRECATED: This file is kept for backward compatibility only.
 * New code should import directly from @/types/domain
 */

import type { TransactionView, Category, BankAccount } from '@/types/domain';

/**
 * @deprecated Use TransactionView from @/types/domain instead
 * Note: TransactionRow represents view data with joined properties like categoryName, accountName
 */
export type TransactionRow = TransactionView;

/**
 * @deprecated Use Category from @/types/domain instead
 */
export type { Category };

/**
 * @deprecated Use BankAccount from @/types/domain instead
 */
export type Account = Pick<BankAccount, 'id' | 'name'>;
