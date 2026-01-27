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
  UpdateRouteInputDTO,
  RoutingDecision,
  SubmissionResult,
  UpdateResult,
  TransactionRequiredField,
} from '../domain/types';

/**
 * Sanitize a string input
 *
 * CTO MANDATE: Components collect raw input. Services sanitize.
 *
 * Sanitization Rules:
 * 1. Trim leading/trailing whitespace
 * 2. Normalize internal whitespace ("Coffee  Shop" → "Coffee Shop")
 * 3. Convert whitespace-only strings to null
 *
 * @param value - Raw string input from component
 * @returns Sanitized string or null if empty/whitespace
 */
function sanitizeString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Trim leading/trailing whitespace
  let sanitized = value.trim();

  // Return null if whitespace-only
  if (sanitized.length === 0) {
    return null;
  }

  // Normalize internal whitespace: "Coffee  Shop" → "Coffee Shop"
  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized;
}

/**
 * Sanitize all string fields in a TransactionRouteInputDTO
 *
 * Called at the service boundary before routing decision.
 * Ensures consistent data regardless of UI input quirks.
 *
 * @param data - Raw DTO from component
 * @returns Sanitized DTO ready for routing/persistence
 */
function sanitizeInput(data: TransactionRouteInputDTO): TransactionRouteInputDTO {
  return {
    ...data,
    description: sanitizeString(data.description),
    notes: sanitizeString(data.notes),
    // accountId and categoryId are UUIDs, no sanitization needed
  };
}

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
   * 1. Sanitize input (CTO Mandate: Service layer sanitizes, not components)
   * 2. Determine route via pure function
   * 3. If complete → call transactionService.create()
   * 4. If partial → call inboxService.create()
   * 5. Return SubmissionResult with route for cache invalidation
   */
  async submitTransaction(data: TransactionRouteInputDTO): Promise<SubmissionResult> {
    // CTO MANDATE: Sanitize at service boundary
    const sanitizedData = sanitizeInput(data);
    const decision = this.determineRoute(sanitizedData);

    if (!decision.hasAnyData) {
      throw new Error('Cannot submit empty transaction data');
    }

    if (decision.route === 'ledger') {
      // PATH A: Complete Data → Ledger
      // All fields are guaranteed to be non-null due to isComplete check
      const entity = await this.transactionService.create({
        accountId: sanitizedData.accountId!,
        categoryId: sanitizedData.categoryId!,
        amountCents: sanitizedData.amountCents!,
        description: sanitizedData.description!,
        date: sanitizedData.date,
        notes: sanitizedData.notes ?? undefined,
      });

      return {
        route: 'ledger',
        id: entity.id,
        success: true,
        entity, // CTO MANDATE: Return entity for optimistic cache prepend
      };
    } else {
      // PATH B: Partial Data → Inbox (Scratchpad)
      const result = await this.inboxService.create({
        amountCents: sanitizedData.amountCents ?? undefined,
        description: sanitizedData.description ?? undefined,
        accountId: sanitizedData.accountId ?? undefined,
        categoryId: sanitizedData.categoryId ?? undefined,
        date: sanitizedData.date,
        notes: sanitizedData.notes ?? undefined,
      });

      if (!result.success) {
        throw new Error(result.error?.message ?? 'Failed to create inbox item');
      }

      return {
        route: 'inbox',
        id: result.data.id,
        success: true,
        entity: result.data, // CTO MANDATE: Return entity for optimistic cache prepend
      };
    }
  }

  /**
   * Update existing transaction with routing logic
   *
   * CTO CRITICAL - Universal Decision Engine:
   * Uses the SAME Sacred Rules as submitTransaction().
   * This ensures one source of truth for routing logic.
   *
   * Automatic Promotion/Demotion:
   * - Inbox item + all 4 fields filled → PROMOTE to Ledger
   * - Ledger item + required field removed → DEMOTE to Inbox
   *
   * Flow:
   * 1. Sanitize input
   * 2. Determine target route via determineRoute()
   * 3. Compare sourceRoute vs targetRoute
   * 4. If same: update in place
   * 5. If different: promote or demote (delete + create)
   * 6. Return UpdateResult with promotion/demotion flags
   */
  async updateTransaction(data: UpdateRouteInputDTO): Promise<UpdateResult> {
    // CTO MANDATE: Sanitize at service boundary
    const sanitizedData = sanitizeInput(data);
    const decision = this.determineRoute(sanitizedData);

    if (!decision.hasAnyData) {
      throw new Error('Cannot update with empty transaction data');
    }

    const { id, version, sourceRoute } = data;
    const targetRoute = decision.route;

    // CASE 1: Same route - update in place
    if (sourceRoute === targetRoute) {
      if (sourceRoute === 'ledger') {
        // Update in Ledger
        const entity = await this.transactionService.update(id, {
          accountId: sanitizedData.accountId!,
          categoryId: sanitizedData.categoryId,
          amountCents: sanitizedData.amountCents!,
          description: sanitizedData.description,
          date: sanitizedData.date,
          notes: sanitizedData.notes ?? undefined,
          version,
        });

        return {
          sourceRoute: 'ledger',
          targetRoute: 'ledger',
          id: entity.id,
          success: true,
          promoted: false,
          demoted: false,
          entity,
        };
      } else {
        // Update in Inbox
        const result = await this.inboxService.update(id, {
          amountCents: sanitizedData.amountCents,
          description: sanitizedData.description,
          accountId: sanitizedData.accountId,
          categoryId: sanitizedData.categoryId,
          date: sanitizedData.date,
          notes: sanitizedData.notes,
          lastKnownVersion: version,
        });

        if (!result.success) {
          throw new Error(result.error?.message ?? 'Failed to update inbox item');
        }

        return {
          sourceRoute: 'inbox',
          targetRoute: 'inbox',
          id: result.data.id,
          success: true,
          promoted: false,
          demoted: false,
          entity: result.data,
        };
      }
    }

    // CASE 2: Promotion (Inbox → Ledger)
    if (sourceRoute === 'inbox' && targetRoute === 'ledger') {
      // Use InboxService.promote() - handles delete + create atomically
      const promoteResult = await this.inboxService.promote({
        inboxId: id,
        accountId: sanitizedData.accountId!,
        categoryId: sanitizedData.categoryId!,
        finalDescription: sanitizedData.description,
        finalDate: sanitizedData.date,
        finalAmountCents: sanitizedData.amountCents,
        exchangeRate: sanitizedData.exchangeRate,
        lastKnownVersion: version,
      });

      if (!promoteResult.success) {
        throw new Error(promoteResult.error?.message ?? 'Failed to promote inbox item');
      }

      // Fetch the created transaction entity for cache update
      const entity = await this.transactionService.getById(promoteResult.data.transactionId);

      return {
        sourceRoute: 'inbox',
        targetRoute: 'ledger',
        id: entity.id,
        success: true,
        promoted: true,
        demoted: false,
        entity,
      };
    }

    // CASE 3: Demotion (Ledger → Inbox)
    // CTO CRITICAL: Keeps Ledger Sacred and 100% complete
    if (sourceRoute === 'ledger' && targetRoute === 'inbox') {
      // Step 1: Delete from Ledger
      await this.transactionService.delete(id, version);

      // Step 2: Create in Inbox with the data
      const inboxResult = await this.inboxService.create({
        amountCents: sanitizedData.amountCents ?? undefined,
        description: sanitizedData.description ?? undefined,
        accountId: sanitizedData.accountId ?? undefined,
        categoryId: sanitizedData.categoryId ?? undefined,
        date: sanitizedData.date,
        notes: sanitizedData.notes ?? undefined,
      });

      if (!inboxResult.success) {
        throw new Error(inboxResult.error?.message ?? 'Failed to demote to inbox');
      }

      return {
        sourceRoute: 'ledger',
        targetRoute: 'inbox',
        id: inboxResult.data.id,
        success: true,
        promoted: false,
        demoted: true,
        entity: inboxResult.data,
      };
    }

    // Should never reach here
    throw new Error(`Invalid route transition: ${sourceRoute} → ${targetRoute}`);
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
