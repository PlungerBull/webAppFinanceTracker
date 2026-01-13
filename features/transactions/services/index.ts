/**
 * Transaction Service Exports
 *
 * Factory function for creating service instances with dependency injection.
 *
 * CTO Mandate #5: Real Dependency Injection (NOT Singletons)
 * - Factory receives repository and auth provider as parameters
 * - Enables testing with mock dependencies
 * - No hidden global state
 *
 * @module transaction-service
 */

import { TransactionService } from './transaction-service';
import type { ITransactionService } from './transaction-service.interface';
import type { ITransactionRepository } from '../repository';
import type { IAuthProvider } from '@/lib/auth';

// Re-export interface
export type { ITransactionService } from './transaction-service.interface';

/**
 * Creates a new transaction service instance
 *
 * Factory pattern with dependency injection.
 * Hooks (or tests) provide the repository and auth provider.
 *
 * @param repository - Transaction repository implementation
 * @param authProvider - Auth provider implementation
 * @returns Service implementation
 *
 * @example
 * ```typescript
 * // Production usage
 * const supabase = createClient();
 * const repository = createTransactionRepository(supabase);
 * const authProvider = new SupabaseAuthProvider(supabase);
 * const service = createTransactionService(repository, authProvider);
 *
 * // Testing usage
 * const mockRepository = createMockRepository();
 * const mockAuth = createMockAuth();
 * const service = createTransactionService(mockRepository, mockAuth);
 * ```
 *
 * Swift equivalent:
 * ```swift
 * func createTransactionService(
 *     repository: TransactionRepositoryProtocol,
 *     authProvider: AuthProviderProtocol
 * ) -> TransactionServiceProtocol {
 *     return TransactionService(repository: repository, authProvider: authProvider)
 * }
 * ```
 */
export function createTransactionService(
  repository: ITransactionRepository,
  authProvider: IAuthProvider
): ITransactionService {
  return new TransactionService(repository, authProvider);
}
