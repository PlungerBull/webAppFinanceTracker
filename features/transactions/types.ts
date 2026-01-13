/**
 * Transaction feature types - Backward compatibility layer
 *
 * DEPRECATED: This file is kept for backward compatibility only.
 *
 * NEW CODE SHOULD USE:
 * - TransactionViewEntity from './domain' (Repository Pattern)
 * - Category, BankAccount from @/types/domain (shared types)
 */

import type { Category, BankAccount } from '@/types/domain';
import type { TransactionViewEntity } from './domain';

/**
 * @deprecated Use TransactionViewEntity from './domain' instead
 * This type alias exists for backward compatibility with existing components.
 *
 * Migration path:
 * 1. Replace imports: `import type { TransactionView } from '@/types/domain'`
 *    with: `import type { TransactionViewEntity } from '@/features/transactions/domain'`
 * 2. Update type annotations: `TransactionView` → `TransactionViewEntity`
 */
export type TransactionRow = TransactionViewEntity;

/**
 * @deprecated Use TransactionViewEntity from './domain' instead
 * Alias for backward compatibility with old code.
 */
export type TransactionView = TransactionViewEntity;

/**
 * @deprecated Use Category from @/types/domain instead
 */
export type { Category };

/**
 * @deprecated Use BankAccount from @/types/domain instead
 */
export type Account = Pick<BankAccount, 'id' | 'name'>;
