/**
 * Transaction Update Hook
 *
 * Provides access to the transaction routing service's updateTransaction method.
 *
 * CTO MANDATES:
 * - Pure Service: Side effects (toast, navigation) via onSuccess callback
 * - Automatic Promotion/Demotion: Same Sacred Rules as submitTransaction
 * - Optimistic Cache Updates: Handle cross-route cache invalidation
 * - Universal Decision Engine: Uses TransactionRoutingService for all updates
 *
 * Key Features:
 * - Edit Inbox item + fill all 4 fields → Promotes to Ledger
 * - Edit Ledger item + remove required field → Demotes to Inbox
 * - Keeps Ledger "Sacred" and 100% complete
 *
 * @module use-transaction-update
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
  UpdateRouteInputDTO,
  RoutingDecision,
  UpdateResult,
  TransactionRouteInputDTO,
} from '../domain/types';

/**
 * Options for useTransactionUpdate hook
 *
 * Callback pattern keeps service pure:
 * - onSuccess: Handle toast, navigation, close panel
 * - onError: Handle error display
 */
export interface UseTransactionUpdateOptions {
  /**
   * Called when update succeeds
   *
   * Use this for side effects:
   * - Show toast message based on result.promoted/demoted
   * - Close panel
   * - Update UI state
   */
  onSuccess: (result: UpdateResult) => void;

  /**
   * Called when update fails
   *
   * Use this for error handling:
   * - Show error toast
   * - Display validation message
   */
  onError?: (error: Error) => void;
}

/**
 * Return type from useTransactionUpdate hook
 */
export interface UseTransactionUpdateResult {
  /**
   * Update transaction with automatic routing
   *
   * Handles:
   * 1. Calling routing service with sanitization
   * 2. Optimistic cache updates based on route changes
   * 3. Calling onSuccess/onError callbacks
   * 4. Cache invalidation for consistency
   */
  update: (data: UpdateRouteInputDTO) => Promise<void>;

  /**
   * Determine routing without updating (pure function)
   *
   * Use this to:
   * - Update button text dynamically
   * - Show missing fields to user
   * - Preview promotion/demotion
   */
  determineRoute: (data: TransactionRouteInputDTO) => RoutingDecision;

  /**
   * Whether an update is in progress
   */
  isUpdating: boolean;

  /**
   * Whether the routing service is ready
   *
   * CTO MANDATE: Orchestrator Rule
   * Check isReady before calling update/determineRoute
   */
  isReady: boolean;

  /**
   * Direct access to routing service (for advanced usage)
   * May be null if not ready (check isReady first)
   */
  routingService: ITransactionRoutingService | null;
}

/**
 * Transaction Update Hook
 *
 * Provides routing-aware update functionality with automatic promotion/demotion.
 *
 * @param options - Callbacks for success/error handling
 * @returns Update functions and state
 *
 * @example
 * ```typescript
 * function TransactionDetailPanel({ transaction, onClose }) {
 *   const { update, determineRoute, isUpdating } = useTransactionUpdate({
 *     onSuccess: (result) => {
 *       if (result.promoted) {
 *         toast.success('Promoted to Ledger');
 *       } else if (result.demoted) {
 *         toast.success('Moved to Inbox');
 *       } else {
 *         toast.success('Transaction updated');
 *       }
 *       onClose();
 *     },
 *     onError: (error) => {
 *       toast.error('Failed to save: ' + error.message);
 *     },
 *   });
 *
 *   const handleSave = (formData) => {
 *     update({
 *       id: transaction.id,
 *       version: transaction.version,
 *       sourceRoute: transaction.sourceRoute,
 *       ...formDataToDTO(formData),
 *     });
 *   };
 *
 *   return (...);
 * }
 * ```
 */
export function useTransactionUpdate(
  options: UseTransactionUpdateOptions
): UseTransactionUpdateResult {
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();
  const transactionService = useTransactionService();

  // CTO MANDATE: Orchestrator Rule
  // Check if transaction service is ready
  const isReady = transactionService !== null;

  // Create routing service with dependencies (only when service is ready)
  const routingService = useMemo(() => {
    if (!transactionService) {
      return null;
    }
    const inboxService = getInboxService();
    return createTransactionRoutingService(transactionService, inboxService);
  }, [transactionService]);

  /**
   * Update transaction with automatic routing
   *
   * Flow:
   * 1. Set isUpdating = true
   * 2. Call routingService.updateTransaction()
   * 3. Handle cache invalidation based on route changes
   * 4. Call onSuccess callback
   * 5. Set isUpdating = false
   *
   * On error:
   * - Call onError callback
   */
  const update = useCallback(
    async (data: UpdateRouteInputDTO): Promise<void> => {
      // CTO MANDATE: Orchestrator Rule
      if (!routingService) {
        options.onError?.(new Error('Service not ready. Please wait for initialization.'));
        return;
      }

      setIsUpdating(true);

      try {
        // 1. Cancel pending queries to prevent race conditions
        await queryClient.cancelQueries({ queryKey: ['transactions'] });
        await queryClient.cancelQueries({ queryKey: [INBOX.QUERY_KEYS.ALL] });

        // 2. Call routing service (includes sanitization + routing decision)
        const result = await routingService.updateTransaction(data);

        // 3. Invalidate caches based on route changes
        if (result.promoted) {
          // Inbox → Ledger: Invalidate both caches
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['accounts'] }); // Balance changed
          queryClient.invalidateQueries({ queryKey: [INBOX.QUERY_KEYS.ALL] });
        } else if (result.demoted) {
          // Ledger → Inbox: Invalidate both caches
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['accounts'] }); // Balance changed
          queryClient.invalidateQueries({ queryKey: [INBOX.QUERY_KEYS.ALL] });
        } else if (result.targetRoute === 'ledger') {
          // Same route (Ledger): Invalidate transactions + accounts
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['accounts'] }); // Amount may have changed
        } else {
          // Same route (Inbox): Invalidate inbox
          queryClient.invalidateQueries({ queryKey: [INBOX.QUERY_KEYS.ALL] });
        }

        // 4. Side effects via callback (Pure Service pattern)
        options.onSuccess(result);
      } catch (error) {
        options.onError?.(error as Error);
      } finally {
        setIsUpdating(false);
      }
    },
    [routingService, queryClient, options]
  );

  /**
   * Determine routing without updating (pure function)
   *
   * Delegates to routingService.determineRoute()
   * Returns 'inbox' route with all fields missing if service not ready
   */
  const determineRoute = useCallback(
    (data: TransactionRouteInputDTO): RoutingDecision => {
      // CTO MANDATE: Orchestrator Rule
      if (!routingService) {
        // Return safe default when not ready
        return {
          route: 'inbox',
          isComplete: false,
          hasAnyData: false,
          missingFields: ['amountCents', 'description', 'accountId', 'categoryId'],
        };
      }
      return routingService.determineRoute(data);
    },
    [routingService]
  );

  return {
    update,
    determineRoute,
    isUpdating,
    isReady,
    routingService,
  };
}
