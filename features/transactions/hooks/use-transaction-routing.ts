/**
 * Transaction Routing Hook
 *
 * Provides access to the transaction routing service with callback pattern.
 *
 * CTO MANDATES:
 * - Pure Service: Side effects (toast, navigation) via onSuccess callback
 * - Zero-Latency UX: Invalidates correct cache based on result.route
 * - DTO Pattern: Converts form data → TransactionRouteInputDTO at component boundary
 *
 * @module use-transaction-routing
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTransactionService } from './use-transaction-service';
import { getInboxService } from '@/features/inbox/services/inbox-service';
import { createTransactionRoutingService } from '../services';
import { INBOX } from '@/lib/constants';
import type { ITransactionRoutingService } from '../services/transaction-routing-service.interface';
import type {
  TransactionRouteInputDTO,
  RoutingDecision,
  SubmissionResult,
} from '../domain/types';

/**
 * Options for useTransactionRouting hook
 *
 * Callback pattern keeps service pure:
 * - onSuccess: Handle toast, navigation, close modal
 * - onError: Handle error display
 */
export interface UseTransactionRoutingOptions {
  /**
   * Called when submission succeeds
   *
   * Use this for side effects:
   * - Show toast message based on result.route
   * - Close modal
   * - Navigate to inbox/transactions
   */
  onSuccess: (result: SubmissionResult) => void;

  /**
   * Called when submission fails
   *
   * Use this for error handling:
   * - Show error toast
   * - Display validation message
   */
  onError?: (error: Error) => void;
}

/**
 * Return type from useTransactionRouting hook
 */
export interface UseTransactionRoutingResult {
  /**
   * Submit transaction to appropriate destination (Ledger or Inbox)
   *
   * Handles:
   * 1. Calling routing service
   * 2. Invalidating correct queries based on route
   * 3. Calling onSuccess/onError callbacks
   */
  submit: (data: TransactionRouteInputDTO) => Promise<void>;

  /**
   * Determine routing without submitting (pure function)
   *
   * Use this to:
   * - Update button text dynamically
   * - Show missing fields to user
   * - Validate before enabling submit button
   */
  determineRoute: (data: TransactionRouteInputDTO) => RoutingDecision;

  /**
   * Whether a submission is in progress
   */
  isSubmitting: boolean;

  /**
   * Direct access to routing service (for advanced usage)
   */
  routingService: ITransactionRoutingService;
}

/**
 * Transaction Routing Hook
 *
 * Provides routing service with callback pattern for side effects.
 *
 * @param options - Callbacks for success/error handling
 * @returns Routing functions and state
 *
 * @example
 * ```typescript
 * function LedgerTransactionModalContent({ onClose }) {
 *   const { submit, determineRoute, isSubmitting } = useTransactionRouting({
 *     onSuccess: (result) => {
 *       toast.success(result.route === 'ledger' ? 'Transaction saved' : 'Draft saved to Inbox');
 *       onClose();
 *     },
 *     onError: (error) => {
 *       toast.error('Failed to save: ' + error.message);
 *     },
 *   });
 *
 *   const decision = determineRoute(formDataToDTO(formData));
 *   const buttonText = decision.isComplete ? 'Add Transaction' : 'Save to Inbox';
 *
 *   return (
 *     <Button onClick={() => submit(formDataToDTO(formData))} disabled={isSubmitting}>
 *       {buttonText}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useTransactionRouting(
  options: UseTransactionRoutingOptions
): UseTransactionRoutingResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const transactionService = useTransactionService();

  // Create routing service with dependencies
  const routingService = useMemo(() => {
    const inboxService = getInboxService();
    return createTransactionRoutingService(transactionService, inboxService);
  }, [transactionService]);

  /**
   * Submit transaction to appropriate destination
   *
   * Flow:
   * 1. Set isSubmitting = true
   * 2. Call routingService.submitTransaction()
   * 3. Invalidate queries based on result.route
   * 4. Call onSuccess callback
   * 5. Set isSubmitting = false
   */
  const submit = useCallback(
    async (data: TransactionRouteInputDTO): Promise<void> => {
      setIsSubmitting(true);
      try {
        const result = await routingService.submitTransaction(data);

        // Invalidate correct queries based on route for Zero-Latency UX
        if (result.route === 'ledger') {
          // Ledger: invalidate transactions and accounts (balance changed)
          await queryClient.invalidateQueries({ queryKey: ['transactions'] });
          await queryClient.invalidateQueries({ queryKey: ['accounts'] });
        } else {
          // Inbox: invalidate inbox queries
          await queryClient.invalidateQueries({ queryKey: INBOX.QUERY_KEYS.ALL });
        }

        // Side effects via callback (Pure Service pattern)
        options.onSuccess(result);
      } catch (error) {
        options.onError?.(error as Error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [routingService, queryClient, options]
  );

  /**
   * Determine routing without submitting (pure function)
   *
   * Delegates to routingService.determineRoute()
   */
  const determineRoute = useCallback(
    (data: TransactionRouteInputDTO): RoutingDecision => {
      return routingService.determineRoute(data);
    },
    [routingService]
  );

  return {
    submit,
    determineRoute,
    isSubmitting,
    routingService,
  };
}
