/**
 * Transaction feature types - Exported from centralized domain types
 *
 * DEPRECATED: This file is kept for backward compatibility only.
 * New code should import directly from @/types/domain
 */

import type { Transaction, Category, BankAccount } from '@/types/domain';

/**
 * @deprecated Use Transaction from @/types/domain instead
 */
export type TransactionRow = Transaction;

/**
 * @deprecated Use Category from @/types/domain instead
 */
export type { Category };

/**
 * @deprecated Use BankAccount from @/types/domain instead
 */
export type Account = Pick<BankAccount, 'id' | 'name'>;
