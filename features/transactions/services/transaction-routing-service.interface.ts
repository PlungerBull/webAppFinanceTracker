/**
 * Transaction Routing Service Interface
 *
 * Decision Engine for Smart Routing (Ledger vs Inbox).
 *
 * CTO NOTE: "The UI's job is to collect inputs. The Service's job is to decide
 * the destination. If the iOS app collects the same inputs, it should land in
 * the same table. No exceptions."
 *
 * This interface defines the contract for routing transaction data:
 * - Complete data (4 fields) → transactions table (Sacred Ledger)
 * - Partial data (1-3 fields) → transaction_inbox table (Scratchpad)
 *
 * The routing logic is centralized here so both Web (TypeScript) and iOS (Swift)
 * can implement identical routing behavior.
 *
 * Swift Protocol Mirror:
 * ```swift
 * protocol TransactionRoutingServiceProtocol {
 *     func determineRoute(data: TransactionRouteInputDTO) -> RoutingDecision
 *     func submitTransaction(data: TransactionRouteInputDTO) async throws -> SubmissionResult
 * }
 * ```
 *
 * @module transaction-routing-service-interface
 */

import type {
  TransactionRouteInputDTO,
  RoutingDecision,
  SubmissionResult,
} from '../domain/types';

/**
 * Transaction Routing Service Interface
 *
 * Central decision engine for routing transaction data.
 * Implements the "Smart Routing" pattern from AI_CONTEXT.md Section F.
 *
 * Key Responsibilities:
 * 1. Determine routing destination based on data completeness (pure function)
 * 2. Submit transaction to appropriate destination (Ledger or Inbox)
 * 3. Return SubmissionResult with route for cache invalidation
 *
 * Side Effects Policy:
 * - determineRoute() is a PURE function (no side effects, 100% testable)
 * - submitTransaction() may have side effects (network calls)
 * - Toast/navigation handled by hook's onSuccess callback (not here)
 */
export interface ITransactionRoutingService {
  /**
   * Determine routing destination based on data completeness
   *
   * PURE FUNCTION - No side effects, deterministic, testable.
   *
   * Business Rules (AI_CONTEXT.md Section F - SACRED):
   * - Complete Data (4 fields) → route: 'ledger'
   * - Partial Data (1-3 fields) → route: 'inbox'
   * - Empty Data (0 fields) → route: 'inbox', hasAnyData: false
   *
   * SACRED RULE for amountCents:
   * - amountCents: null → MISSING
   * - amountCents: 0 → MISSING (prevents balance bugs with $0.00 entries)
   * - amountCents: -100 → VALID (expense)
   * - amountCents: 100 → VALID (income)
   *
   * @param data - Transaction route input DTO (clean data contract)
   * @returns Routing decision with missing fields for UI highlighting
   *
   * @example
   * ```typescript
   * const decision = routingService.determineRoute({
   *   amountCents: 1050,      // $10.50
   *   description: 'Coffee',
   *   accountId: 'acc-123',
   *   categoryId: 'cat-456',
   *   date: '2024-01-12T10:00:00.000Z',
   * });
   * // decision.route === 'ledger'
   * // decision.isComplete === true
   * // decision.missingFields === []
   * ```
   *
   * @example
   * ```typescript
   * const decision = routingService.determineRoute({
   *   amountCents: 1050,
   *   description: 'Coffee',
   *   accountId: null,        // Missing!
   *   categoryId: null,       // Missing!
   *   date: '2024-01-12T10:00:00.000Z',
   * });
   * // decision.route === 'inbox'
   * // decision.isComplete === false
   * // decision.missingFields === ['accountId', 'categoryId']
   * ```
   */
  determineRoute(data: TransactionRouteInputDTO): RoutingDecision;

  /**
   * Submit transaction to appropriate destination
   *
   * Flow:
   * 1. Call determineRoute() to decide destination
   * 2. If complete → call TransactionService.create() → Ledger
   * 3. If partial → call InboxService.create() → Inbox
   * 4. Return SubmissionResult with route for cache invalidation
   *
   * The returned route enables Zero-Latency UX:
   * - UI uses result.route to immediately invalidate correct query cache
   * - 'ledger' → invalidate ['transactions'], ['accounts']
   * - 'inbox' → invalidate ['inbox']
   *
   * SIDE EFFECTS:
   * - Makes network calls to create records
   * - Does NOT show toasts or navigate (hook handles that via onSuccess callback)
   *
   * @param data - Transaction route input DTO
   * @returns Promise resolving to SubmissionResult with route and id
   * @throws Error if submission fails (network error, validation error, etc.)
   *
   * @example
   * ```typescript
   * const result = await routingService.submitTransaction({
   *   amountCents: 1050,
   *   description: 'Coffee',
   *   accountId: 'acc-123',
   *   categoryId: 'cat-456',
   *   date: '2024-01-12T10:00:00.000Z',
   * });
   * // result.route === 'ledger'
   * // result.id === 'txn-789' (new transaction ID)
   * // result.success === true
   * ```
   */
  submitTransaction(data: TransactionRouteInputDTO): Promise<SubmissionResult>;
}
