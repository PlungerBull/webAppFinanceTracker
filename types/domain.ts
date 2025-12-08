/**
 * Domain types - Single source of truth derived from database schema
 *
 * These types are derived directly from the auto-generated database.types.ts
 * to prevent duplication and ensure consistency across the application.
 */

import { Database } from './database.types';

// Core domain types derived from database views and tables
export type Transaction = Database['public']['Views']['transactions_view']['Row'];
export type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Budget = Database['public']['Tables']['budgets']['Row'];
export type ParentCategory = Database['public']['Views']['parent_categories_with_counts']['Row'];

// Helper type for transaction form data (if needed)
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];
