/**
 * Transfer Service Interface
 *
 * Business logic layer for transfer operations.
 * Handles auth extraction and delegates to repository.
 *
 * @module transfer-service.interface
 */

import type { CreateTransferDTO } from '../domain';
import type { TransferCreationResult } from '../repository/transfer-repository.interface';

/**
 * Transfer Service Interface
 *
 * Service methods extract userId from auth provider internally.
 * Throws on errors (unlike repository which returns DataResult).
 */
export interface ITransferService {
  /**
   * Create a transfer between two accounts
   *
   * @param data - Transfer creation DTO (integer cents)
   * @returns Transfer creation result with transaction IDs
   * @throws TransferRepositoryError on failure
   */
  create(data: CreateTransferDTO): Promise<TransferCreationResult>;
}
