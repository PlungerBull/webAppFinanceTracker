/**
 * Shared type definitions for transactions feature
 *
 * These types are derived from the database schema to maintain a single source of truth.
 * Using Pick utility type to explicitly select only the fields needed by components.
 */

import type { Tables } from '@/types/database.types';

/**
 * Transaction row type from transactions_view
 * Contains all fields commonly used across transaction components
 */
export type TransactionRow = Pick<
  Tables<'transactions_view'>,
  'id' | 'date' | 'description' | 'category_name' | 'category_color' |
  'category_id' | 'amount_original' | 'currency_original' | 'account_name' |
  'account_id' | 'exchange_rate' | 'notes'
>;

/**
 * Simplified category type
 * Contains only the essential fields needed for displaying category information
 */
export type Category = Pick<
  Tables<'categories'>,
  'id' | 'name' | 'color' | 'parent_id'
>;

/**
 * Simplified account type
 * Contains only the essential fields needed for displaying account information
 */
export type Account = Pick<
  Tables<'bank_accounts'>,
  'id' | 'name'
>;
