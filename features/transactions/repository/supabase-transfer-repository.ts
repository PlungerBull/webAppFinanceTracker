/**
 * Supabase Transfer Repository Implementation
 *
 * Implements ITransferRepository using Supabase as the data store.
 *
 * CTO MANDATES:
 * - Atomic Transfer Protocol: MUST use create_transfer RPC exclusively
 * - Sacred Integer Arithmetic: Pass BIGINT cents directly to RPC (ADR 001)
 * - DataResult pattern (never throws)
 *
 * @module supabase-transfer-repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { DataResult } from '@/lib/data-patterns';
import type { ITransferRepository, TransferCreationResult } from './transfer-repository.interface';
import type { CreateTransferDTO } from '../domain';

/**
 * Transfer Repository Error
 */
export class TransferRepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'TransferRepositoryError';
  }
}

/**
 * Transfer Validation Error
 */
export class TransferValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string
  ) {
    super(message);
    this.name = 'TransferValidationError';
  }
}

/**
 * Supabase Transfer Repository
 *
 * Handles atomic transfer creation via RPC.
 */
export class SupabaseTransferRepository implements ITransferRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) { }

  async create(
    userId: string,
    data: CreateTransferDTO
  ): Promise<DataResult<TransferCreationResult>> {
    try {
      // Validate input
      if (!data.fromAccountId) {
        return {
          success: false,
          data: null,
          error: new TransferValidationError(
            'Source account is required',
            'fromAccountId'
          ),
        };
      }
      if (!data.toAccountId) {
        return {
          success: false,
          data: null,
          error: new TransferValidationError(
            'Destination account is required',
            'toAccountId'
          ),
        };
      }
      if (data.fromAccountId === data.toAccountId) {
        return {
          success: false,
          data: null,
          error: new TransferValidationError(
            'Cannot transfer to the same account',
            'toAccountId'
          ),
        };
      }
      if (data.sentAmountCents <= 0) {
        return {
          success: false,
          data: null,
          error: new TransferValidationError(
            'Amount must be positive',
            'sentAmountCents'
          ),
        };
      }
      if (data.receivedAmountCents <= 0) {
        return {
          success: false,
          data: null,
          error: new TransferValidationError(
            'Received amount must be positive',
            'receivedAmountCents'
          ),
        };
      }

      // Calculate implied exchange rate from amounts
      // This is more accurate than user-entered rates
      //
      // CTO NOTE: Exchange rate is a float (receivedCents / sentCents).
      // RISK: If we reconstruct amounts from this rate later, we may be off by fractions.
      // MITIGATION: The DB stores actual sent/received integers as source of truth.
      // The rate is metadata for display only - never used to derive amounts.
      const impliedExchangeRate = data.receivedAmountCents / data.sentAmountCents;

      // CTO Mandate: Use create_transfer RPC exclusively for atomicity
      // S-TIER: Pass integer cents directly to RPC (ADR 001 - Sacred Integer Arithmetic)
      // VERIFIED: The RPC is plpgsql which wraps both INSERTs in an implicit transaction.
      // If either INSERT fails, the entire operation rolls back automatically.
      const { data: rpcResult, error: rpcError } = await this.supabase.rpc(
        'create_transfer',
        {
          p_user_id: userId,
          p_from_account_id: data.fromAccountId,
          p_to_account_id: data.toAccountId,
          p_amount_cents: data.sentAmountCents,         // BIGINT cents - no conversion
          p_amount_received_cents: data.receivedAmountCents, // BIGINT cents - no conversion
          p_exchange_rate: impliedExchangeRate,
          p_date: data.date,
          p_description: data.description || 'Transfer',
          p_category_id: undefined // Rely on SQL DEFAULT NULL
        }
      );

      if (rpcError) {
        return {
          success: false,
          data: null,
          error: new TransferRepositoryError(
            `Failed to create transfer: ${rpcError.message}`,
            rpcError
          ),
        };
      }

      // RPC returns { transfer_id, from_transaction_id, to_transaction_id }
      const result = rpcResult as {
        transfer_id: string;
        from_transaction_id: string;
        to_transaction_id: string;
      };

      return {
        success: true,
        data: {
          transferId: result.transfer_id,
          fromTransactionId: result.from_transaction_id,
          toTransactionId: result.to_transaction_id,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransferRepositoryError(
          `Unexpected error creating transfer: ${(err as Error).message}`,
          err
        ),
      };
    }
  }
}

/**
 * Factory function for creating transfer repository
 */
export function createTransferRepository(
  supabase: SupabaseClient<Database>
): ITransferRepository {
  return new SupabaseTransferRepository(supabase);
}
