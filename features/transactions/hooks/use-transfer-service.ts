/**
 * Transfer Service Hook
 *
 * React hook for accessing the transfer service.
 * Creates service instance with Supabase client and auth provider.
 *
 * @module use-transfer-service
 */

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { createTransferRepository } from '../repository/supabase-transfer-repository';
import { createTransferService } from '../services/transfer-service';
import type { ITransferService } from '../services/transfer-service.interface';

/**
 * Use Transfer Service
 *
 * Creates and memoizes a transfer service instance.
 * Uses Supabase client and auth provider under the hood.
 *
 * @returns Transfer service instance
 *
 * @example
 * ```typescript
 * function TransferForm() {
 *   const service = useTransferService();
 *
 *   const handleSubmit = async (data) => {
 *     await service.create(data);
 *   };
 * }
 * ```
 */
export function useTransferService(): ITransferService {
  return useMemo(() => {
    const supabase = createClient();
    const authProvider = createSupabaseAuthProvider(supabase);
    const repository = createTransferRepository(supabase);
    return createTransferService(repository, authProvider);
  }, []);
}
