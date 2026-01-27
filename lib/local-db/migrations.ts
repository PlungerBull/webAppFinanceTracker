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
  // Uncomment when adding migrations:
  // createTable,
  // addColumns,
  // Migration,
} from '@nozbe/watermelondb/Schema/migrations';

/**
 * WatermelonDB Migrations Configuration
 *
 * Initial version: 1 (no migrations needed for first install)
 * Future migrations will be added here as the schema evolves.
 *
 * Example migration pattern (for version 2+):
 * ```
 * {
 *   toVersion: 2,
 *   steps: [
 *     addColumns({
 *       table: 'transactions',
 *       columns: [
 *         { name: 'new_field', type: 'string', isOptional: true },
 *       ],
 *     }),
 *   ],
 * }
 * ```
 */
export const migrations = schemaMigrations({
  migrations: [
    // Version 1 is the initial schema - no migration needed
    // Future migrations will be added here
  ],
});
