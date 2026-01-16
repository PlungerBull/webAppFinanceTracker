/**
 * Transfer Service Implementation
 *
 * Business logic layer for transfer operations.
 * Handles auth extraction and delegates to repository.
 *
 * @module transfer-service
 */

import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { ITransferRepository, TransferCreationResult } from '../repository/transfer-repository.interface';
import type { ITransferService } from './transfer-service.interface';
import type { CreateTransferDTO } from '../domain';

/**
 * Transfer Service
 *
 * Handles auth extraction and error translation.
 */
export class TransferService implements ITransferService {
  constructor(
    private readonly repository: ITransferRepository,
    private readonly authProvider: IAuthProvider
  ) {}

  async create(data: CreateTransferDTO): Promise<TransferCreationResult> {
    const userId = await this.authProvider.getCurrentUserId();
    const result = await this.repository.create(userId, data);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }
}

/**
 * Factory function for creating transfer service
 */
export function createTransferService(
  repository: ITransferRepository,
  authProvider: IAuthProvider
): ITransferService {
  return new TransferService(repository, authProvider);
}
