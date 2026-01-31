/**
 * Transfer Repository Interface
 *
 * Defines the contract for transfer data operations.
 * Transfers create two linked transactions atomically.
 *
 * CTO Mandate #1: Atomic Transfer Protocol
 * - Single RPC call creates BOTH transactions
 * - All-or-nothing: both succeed or both fail
 * - Use `create_transfer` RPC exclusively
 *
 * @module transfer-repository.interface
 */

import type { DataResult } from '@/lib/data-patterns';
import type { CreateTransferDTO } from '../domain';

/**
 * Transfer Creation Result (from RPC)
 */
export interface TransferCreationResult {
  readonly transferId: string;
  readonly fromTransactionId: string;
  readonly toTransactionId: string;
}

/**
 * Transfer Repository Interface
 *
 * All methods return DataResult for explicit error handling.
 * RLS is enforced via userId parameter.
 */
export interface ITransferRepository {
  /**
   * Create a transfer between two accounts
   *
   * CTO Mandate: MUST use create_transfer RPC for atomicity.
   * Never attempt two separate inserts.
   *
   * @param userId - User ID (for RLS)
   * @param data - Transfer creation DTO (integer cents)
   * @returns DataResult with transfer IDs
   */
  create(
    userId: string,
    data: CreateTransferDTO
  ): Promise<DataResult<TransferCreationResult>>;
}
