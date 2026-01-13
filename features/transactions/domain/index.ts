/**
 * Transaction Domain Exports
 *
 * Centralized exports for the transaction domain layer.
 *
 * Architecture:
 * - Entities: Core domain models (TransactionEntity, TransactionViewEntity)
 * - Types: DTOs and result types (CreateTransactionDTO, DataResult<T>)
 * - Constants: Validation rules and error messages (shared with iOS)
 * - Errors: Domain-specific error classes
 *
 * @module transaction-domain
 */

// Domain Entities
export * from './entities';

// Domain Types (DTOs, DataResult, etc.)
export * from './types';

// Domain Constants (Validation rules)
export * from './constants';

// Domain Errors
export * from './errors';
