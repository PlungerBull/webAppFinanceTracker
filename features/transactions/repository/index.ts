/**
 * Transaction Repository Exports
 *
 * Factory function for creating repository instances with dependency injection.
 *
 * CTO Mandate #5: Real Dependency Injection (NOT Singletons)
 * - Factory receives SupabaseClient as parameter
 * - Enables testing with mock clients
 * - No hidden global state
 *
 * @module transaction-repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { SupabaseTransactionRepository } from './supabase-transaction-repository';
import type { ITransactionRepository } from './transaction-repository.interface';

// Re-export interface
export type { ITransactionRepository } from './transaction-repository.interface';

/**
 * Creates a new transaction repository instance
 *
 * Factory pattern with dependency injection.
 * Service layer (or tests) provides the Supabase client.
 *
 * @param supabase - Supabase client instance
 * @returns Repository implementation
 *
 * @example
 * ```typescript
 * // Production usage
 * const supabase = createClient();
 * const repository = createTransactionRepository(supabase);
 *
 * // Testing usage
 * const mockSupabase = createMockClient();
 * const repository = createTransactionRepository(mockSupabase);
 * ```
 *
 * Swift equivalent:
 * ```swift
 * func createTransactionRepository(supabase: SupabaseClient) -> TransactionRepositoryProtocol {
 *     return SupabaseTransactionRepository(supabase: supabase)
 * }
 * ```
 */
export function createTransactionRepository(
  supabase: SupabaseClient<Database>
): ITransactionRepository {
  return new SupabaseTransactionRepository(supabase);
}
