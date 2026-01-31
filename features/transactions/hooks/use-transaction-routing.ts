/**
 * Transaction Routing Hook
 *
 * Provides access to the transaction routing service with callback pattern.
 *
 * CTO MANDATES:
 * - Pure Service: Side effects (toast, navigation) via onSuccess callback
 * - Zero-Latency UX: Optimistic cache prepend (NOT invalidation)
 * - DTO Pattern: Converts form data → TransactionRouteInputDTO at component boundary
 * - Empty Cache Edge Case: Gracefully bail out if no cached data
 *
 * @module use-transaction-routing
 */

'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTransactionService } from './use-transaction-service';
import { useInboxOperations } from '@/lib/hooks/use-inbox-operations';
import { createTransactionRoutingService } from '../services';
import { INBOX } from '@/lib/constants';
import type { ITransactionRoutingService } from '../services/transaction-routing-service.interface';
import type {
  TransactionRouteInputDTO,
  RoutingDecision,
  SubmissionResult,
} from '../domain/types';
import type { TransactionViewEntity } from '../domain/entities';
import type { InboxItemViewEntity } from '@/domain/inbox';

/**
 * React Query infinite query data structure.
 * Used for type-safe cache updates without relying on `any`.
 */
interface InfiniteQueryData<T> {
  pages: Array<{ data: T[]; count?: number }>;
  pageParams: unknown[];
}

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
   * 2. Optimistic cache prepend based on route
   * 3. Calling onSuccess/onError callbacks
   * 4. Rollback on error, invalidate on settle
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
   * Whether the routing service is ready
   *
   * CTO MANDATE: Orchestrator Rule
   * Check isReady before calling submit/determineRoute
   */
  isReady: boolean;

  /**
   * Direct access to routing service (for advanced usage)
   * May be null if not ready (check isReady first)
   */
  routingService: ITransactionRoutingService | null;
}

/**
 * Snapshot context for rollback
 */
interface OptimisticContext {
  previousTransactions: unknown;
  previousInbox: unknown;
  route: 'ledger' | 'inbox';
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
  const contextRef = useRef<OptimisticContext | null>(null);

  // CTO MANDATE: Orchestrator Rule
  // Check if transaction service is ready
  const isReady = transactionService !== null;

  // Get inbox operations via IoC hook (avoids direct feature coupling)
  const inboxOperations = useInboxOperations();

  // Create routing service with dependencies (only when service is ready)
  const routingService = useMemo(() => {
    if (!transactionService) {
      return null;
    }
    return createTransactionRoutingService(transactionService, inboxOperations);
  }, [transactionService, inboxOperations]);

  /**
   * Optimistically prepend entity to ledger cache (transactions infinite query)
   *
   * CTO MANDATE: Handle pages[0].data for infinite queries
   */
  const prependToLedger = useCallback(
    (entity: TransactionViewEntity): unknown => {
      // Snapshot for rollback
      const previous = queryClient.getQueryData(['transactions', 'infinite']);

      // CTO MANDATE: Empty cache edge case - bail out gracefully
      if (!previous) {
        return null;
      }

      // Prepend to first page of infinite query
      queryClient.setQueryData(['transactions', 'infinite'], (old: InfiniteQueryData<TransactionViewEntity> | undefined) => {
        if (!old?.pages?.length) return old;

        const newPages = [...old.pages];
        newPages[0] = {
          ...newPages[0],
          data: [entity, ...newPages[0].data],
          count: (newPages[0].count ?? 0) + 1,
        };

        return {
          ...old,
          pages: newPages,
        };
      });

      return previous;
    },
    [queryClient]
  );

  /**
   * Optimistically prepend entity to inbox cache
   *
   * CTO MANDATE: Handle pages[0].data for infinite queries
   */
  const prependToInbox = useCallback(
    (entity: InboxItemViewEntity): unknown => {
      // Snapshot for rollback
      const previous = queryClient.getQueryData([INBOX.QUERY_KEYS.ALL, 'infinite']);

      // CTO MANDATE: Empty cache edge case - bail out gracefully
      if (!previous) {
        return null;
      }

      // Prepend to first page of infinite query
      queryClient.setQueryData([INBOX.QUERY_KEYS.ALL, 'infinite'], (old: InfiniteQueryData<InboxItemViewEntity> | undefined) => {
        if (!old?.pages?.length) return old;

        const newPages = [...old.pages];
        newPages[0] = {
          ...newPages[0],
          data: [entity, ...newPages[0].data],
          count: (newPages[0].count ?? 0) + 1,
        };

        return {
          ...old,
          pages: newPages,
        };
      });

      return previous;
    },
    [queryClient]
  );

  /**
   * Rollback optimistic update on error
   */
  const rollback = useCallback(() => {
    const ctx = contextRef.current;
    if (!ctx) return;

    if (ctx.route === 'ledger' && ctx.previousTransactions) {
      queryClient.setQueryData(['transactions', 'infinite'], ctx.previousTransactions);
    } else if (ctx.route === 'inbox' && ctx.previousInbox) {
      queryClient.setQueryData([INBOX.QUERY_KEYS.ALL, 'infinite'], ctx.previousInbox);
    }

    contextRef.current = null;
  }, [queryClient]);

  /**
   * Submit transaction to appropriate destination
   *
   * Flow:
   * 1. Set isSubmitting = true
   * 2. Call routingService.submitTransaction()
   * 3. Optimistically prepend entity to cache
   * 4. Call onSuccess callback
   * 5. Invalidate for consistency (settle)
   * 6. Set isSubmitting = false
   *
   * On error:
   * - Rollback optimistic update
   * - Call onError callback
   */
  const submit = useCallback(
    async (data: TransactionRouteInputDTO): Promise<void> => {
      // CTO MANDATE: Orchestrator Rule
      if (!routingService) {
        options.onError?.(new Error('Service not ready. Please wait for initialization.'));
        return;
      }

      setIsSubmitting(true);

      try {
        // 1. Cancel pending queries to prevent race conditions
        await queryClient.cancelQueries({ queryKey: ['transactions'] });
        await queryClient.cancelQueries({ queryKey: [INBOX.QUERY_KEYS.ALL] });

        // 2. Call routing service (includes sanitization)
        const result = await routingService.submitTransaction(data);

        // 3. Optimistically prepend entity to cache based on route
        if (result.route === 'ledger') {
          const previous = prependToLedger(result.entity as TransactionViewEntity);
          contextRef.current = {
            previousTransactions: previous,
            previousInbox: null,
            route: 'ledger',
          };
        } else {
          const previous = prependToInbox(result.entity as InboxItemViewEntity);
          contextRef.current = {
            previousTransactions: null,
            previousInbox: previous,
            route: 'inbox',
          };
        }

        // 4. Side effects via callback (Pure Service pattern)
        options.onSuccess(result);

        // 5. Invalidate for consistency (settle) - happens in background
        // This ensures server truth is reflected even if optimistic update was slightly off
        if (result.route === 'ledger') {
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['accounts'] }); // Balance changed
        } else {
          queryClient.invalidateQueries({ queryKey: [INBOX.QUERY_KEYS.ALL] });
        }
      } catch (error) {
        // Rollback optimistic update on error
        rollback();
        options.onError?.(error as Error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [routingService, queryClient, options, prependToLedger, prependToInbox, rollback]
  );

  /**
   * Determine routing without submitting (pure function)
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
    submit,
    determineRoute,
    isSubmitting,
    isReady,
    routingService,
  };
}
