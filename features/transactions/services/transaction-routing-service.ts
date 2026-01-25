/**
 * Transaction Routing Service Implementation
 *
 * Centralizes the "Smart Routing" logic previously embedded in AddTransactionModal.
 * iOS can mirror this class exactly for identical routing behavior.
 *
 * CTO NOTE: "The UI's job is to collect inputs. The Service's job is to decide
 * the destination. If the iOS app collects the same inputs, it should land in
 * the same table. No exceptions."
 *
 * Routing Rules (Data Entry Strategy - Scratchpad Pattern):
 * - Complete Data (4 fields) → Write to `transactions` table (Ledger)
 * - Partial Data (1-3 fields) → Write to `transaction_inbox` table (Inbox)
 * - Empty Data (0 fields) → Invalid, hasAnyData: false
 *
 * Swift Class Mirror:
 * ```swift
 * class TransactionRoutingService: TransactionRoutingServiceProtocol {
 *     private let transactionService: TransactionServiceProtocol
 *     private let inboxService: InboxServiceProtocol
 *
 *     func determineRoute(data: TransactionRouteInputDTO) -> RoutingDecision {
 *         // Identical logic to TypeScript implementation
 *     }
 * }
 * ```
 *
 * @module transaction-routing-service
 */

import type { ITransactionRoutingService } from './transaction-routing-service.interface';
import type { ITransactionService } from './transaction-service.interface';
import type { InboxService } from '@/features/inbox/services/inbox-service';
import type {
  TransactionRouteInputDTO,
  RoutingDecision,
  SubmissionResult,
  TransactionRequiredField,
} from '../domain/types';

/**
 * Transaction Routing Service
 *
 * Decision Engine for Smart Routing.
 * Pure business logic, no React dependencies.
 */
export class TransactionRoutingService implements ITransactionRoutingService {
  constructor(
    private readonly transactionService: ITransactionService,
    private readonly inboxService: InboxService
  ) {}

  /**
   * Determine routing destination based on data completeness
   *
   * PURE FUNCTION - No side effects, deterministic, 100% testable.
   *
   * Required fields for Ledger (Sacred Ledger Rule):
   * 1. amountCents - Must be non-null AND non-zero
   * 2. description - Must be non-null AND non-empty (after trim)
   * 3. accountId - Must be non-null AND non-empty
   * 4. categoryId - Must be non-null AND non-empty
   *
   * SACRED RULE: amountCents: 0 is treated as MISSING
   * This prevents $0.00 transactions from entering the ledger,
   * which would break balance calculations.
   */
  determineRoute(data: TransactionRouteInputDTO): RoutingDecision {
    const missingFields: TransactionRequiredField[] = [];

    // Check amountCents (SACRED RULE: 0 is MISSING)
    const hasAmount = data.amountCents !== null && data.amountCents !== 0;
    if (!hasAmount) {
      missingFields.push('amountCents');
    }

    // Check description (empty string is MISSING)
    const hasDescription =
      data.description !== null &&
      typeof data.description === 'string' &&
      data.description.trim().length > 0;
    if (!hasDescription) {
      missingFields.push('description');
    }

    // Check accountId
    const hasAccount =
      data.accountId !== null &&
      typeof data.accountId === 'string' &&
      data.accountId.length > 0;
    if (!hasAccount) {
      missingFields.push('accountId');
    }

    // Check categoryId
    const hasCategory =
      data.categoryId !== null &&
      typeof data.categoryId === 'string' &&
      data.categoryId.length > 0;
    if (!hasCategory) {
      missingFields.push('categoryId');
    }

    // Determine routing
    const isComplete = missingFields.length === 0;
    const hasAnyData = hasAmount || hasDescription || hasAccount || hasCategory;

    return {
      route: isComplete ? 'ledger' : 'inbox',
      isComplete,
      hasAnyData,
      missingFields,
    };
  }

  /**
   * Submit transaction to appropriate destination
   *
   * Flow:
   * 1. Determine route via pure function
   * 2. If complete → call transactionService.create()
   * 3. If partial → call inboxService.create()
   * 4. Return SubmissionResult with route for cache invalidation
   */
  async submitTransaction(data: TransactionRouteInputDTO): Promise<SubmissionResult> {
    const decision = this.determineRoute(data);

    if (!decision.hasAnyData) {
      throw new Error('Cannot submit empty transaction data');
    }

    if (decision.route === 'ledger') {
      // PATH A: Complete Data → Ledger
      // All fields are guaranteed to be non-null due to isComplete check
      const result = await this.transactionService.create({
        accountId: data.accountId!,
        categoryId: data.categoryId!,
        amountCents: data.amountCents!,
        description: data.description!,
        date: data.date,
        notes: data.notes ?? undefined,
      });

      return {
        route: 'ledger',
        id: result.id,
        success: true,
      };
    } else {
      // PATH B: Partial Data → Inbox (Scratchpad)
      const result = await this.inboxService.create({
        amountCents: data.amountCents ?? undefined,
        description: data.description ?? undefined,
        accountId: data.accountId ?? undefined,
        categoryId: data.categoryId ?? undefined,
        date: data.date,
        notes: data.notes ?? undefined,
      });

      if (!result.success) {
        throw new Error(result.error?.message ?? 'Failed to create inbox item');
      }

      return {
        route: 'inbox',
        id: result.data.id,
        success: true,
      };
    }
  }
}

/**
 * Factory function for creating routing service
 *
 * Used for dependency injection in hooks and tests.
 *
 * @param transactionService - Service for ledger operations
 * @param inboxService - Service for inbox operations
 * @returns TransactionRoutingService instance
 */
export function createTransactionRoutingService(
  transactionService: ITransactionService,
  inboxService: InboxService
): ITransactionRoutingService {
  return new TransactionRoutingService(transactionService, inboxService);
}
