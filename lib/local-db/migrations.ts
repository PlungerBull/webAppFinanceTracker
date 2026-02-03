/**
 * WatermelonDB Migrations
 *
 * CTO MANDATE: Migration Versioning
 * - Each schema change increments version and adds a migration step
 * - NEVER modify existing migration steps
 * - Migration steps are additive only
 *
 * Version History:
 * - 1: Initial schema (bank_accounts, transactions, categories, transaction_inbox,
 *      global_currencies, sync_metadata)
 *
 * @module local-db/migrations
 */

import {
  schemaMigrations,
  addColumns,
} from '@nozbe/watermelondb/Schema/migrations';

/**
 * WatermelonDB Migrations Configuration
 *
 * Version History:
 * - 1: Initial schema (bank_accounts, transactions, categories, transaction_inbox,
 *      global_currencies, sync_metadata)
 * - 2: Add sync_error field to all syncable models for per-record error tracking
 */
export const migrations = schemaMigrations({
  migrations: [
    {
      // Version 2: Add sync_error field for per-record error messages
      // CTO MANDATE: Enables users to see WHY a record is in CONFLICT status
      toVersion: 2,
      steps: [
        addColumns({
          table: 'bank_accounts',
          columns: [{ name: 'sync_error', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'transactions',
          columns: [{ name: 'sync_error', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'categories',
          columns: [{ name: 'sync_error', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'transaction_inbox',
          columns: [{ name: 'sync_error', type: 'string', isOptional: true }],
        }),
      ],
    },
  ],
});
