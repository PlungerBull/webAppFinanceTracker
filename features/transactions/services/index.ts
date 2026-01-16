/**
 * Transaction Service Exports
 *
 * Factory functions for creating service instances with dependency injection.
 *
 * CTO Mandate #5: Real Dependency Injection (NOT Singletons)
 * - Factory receives repository and auth provider as parameters
 * - Enables testing with mock dependencies
 * - No hidden global state
 *
 * @module transaction-service
 */

import { TransactionService } from './transaction-service';
import { TransferService } from './transfer-service';
import type { ITransactionService } from './transaction-service.interface';
import type { ITransferService } from './transfer-service.interface';
import type { ITransactionRepository, ITransferRepository } from '../repository';
import type { IAuthProvider } from '@/lib/auth';

// Re-export interfaces
export type { ITransactionService } from './transaction-service.interface';
export type { ITransferService } from './transfer-service.interface';

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

/**
 * Creates a new transfer service instance
 *
 * Factory pattern with dependency injection.
 * Hooks (or tests) provide the repository and auth provider.
 *
 * @param repository - Transfer repository implementation
 * @param authProvider - Auth provider implementation
 * @returns Service implementation
 */
export function createTransferService(
  repository: ITransferRepository,
  authProvider: IAuthProvider
): ITransferService {
  return new TransferService(repository, authProvider);
}
