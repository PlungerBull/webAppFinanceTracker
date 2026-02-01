/**
 * Types Index - Central export for database types
 *
 * All imports of database types should use:
 *   import type { Database } from '@/types'
 *
 * This allows future migrations to update the source without changing imports.
 */

export * from './supabase';
export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from './supabase';
