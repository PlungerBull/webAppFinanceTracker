/**
 * Performance Guardrail Utilities
 *
 * S-TIER ARCHITECTURE: Silent Guardrail Pattern
 * Uses performance.now() for Chrome/Safari Profiler visibility
 * without cluttering production logs.
 */

import { GUARDRAILS } from '@/lib/constants/guardrails.constants';

/**
 * Measure and log computation time in development.
 *
 * Uses performance.now() for high-resolution timing visible
 * in Chrome DevTools Performance tab.
 *
 * @param name - Label for the computation (shown in warning)
 * @param fn - Function to measure
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const grouped = measurePerf('groupCategories', () =>
 *   groupCategoriesByParent(categories)
 * );
 * ```
 */
export function measurePerf<T>(name: string, fn: () => T): T {
  if (!GUARDRAILS.DEV.LOG_WARNINGS) return fn();

  const start = performance.now();
  const result = fn();
  const elapsed = performance.now() - start;

  if (elapsed > GUARDRAILS.DEV.PERF_WARN_THRESHOLD_MS) {
    console.warn(
      `[PERF] ${name} took ${Math.round(elapsed)}ms ` +
        `(threshold: ${GUARDRAILS.DEV.PERF_WARN_THRESHOLD_MS}ms)`
    );
  }

  return result;
}

/**
 * Check category data against scalability guardrails.
 * Logs warnings in development when thresholds are exceeded.
 *
 * @param categories - Array of categories to check
 */
export function checkCategoryGuardrails(
  categories: { parentId: string | null }[]
): void {
  if (!GUARDRAILS.DEV.LOG_WARNINGS) return;

  const total = categories.length;
  if (total > GUARDRAILS.CATEGORIES.WARN_TOTAL) {
    console.warn(
      `[GUARDRAIL] Category count (${total}) exceeds warning threshold ` +
        `(${GUARDRAILS.CATEGORIES.WARN_TOTAL}). Consider pagination or lazy loading.`
    );
  }

  // Check children per parent
  const childrenCount = new Map<string, number>();
  for (const cat of categories) {
    if (cat.parentId) {
      childrenCount.set(
        cat.parentId,
        (childrenCount.get(cat.parentId) || 0) + 1
      );
    }
  }

  for (const [parentId, count] of childrenCount) {
    if (count > GUARDRAILS.CATEGORIES.WARN_CHILDREN_PER_PARENT) {
      console.warn(
        `[GUARDRAIL] Parent category ${parentId} has ${count} children, ` +
          `exceeds threshold (${GUARDRAILS.CATEGORIES.WARN_CHILDREN_PER_PARENT}).`
      );
    }
  }
}

/**
 * Check account data against scalability guardrails.
 * Logs warnings in development when thresholds are exceeded.
 *
 * @param accounts - Array of accounts to check
 */
export function checkAccountGuardrails(accounts: { groupId: string }[]): void {
  if (!GUARDRAILS.DEV.LOG_WARNINGS) return;

  const total = accounts.length;
  if (total > GUARDRAILS.ACCOUNTS.WARN_TOTAL) {
    console.warn(
      `[GUARDRAIL] Account count (${total}) exceeds warning threshold ` +
        `(${GUARDRAILS.ACCOUNTS.WARN_TOTAL}). Consider pagination.`
    );
  }

  // Check accounts per group
  const groupCount = new Map<string, number>();
  for (const acc of accounts) {
    groupCount.set(acc.groupId, (groupCount.get(acc.groupId) || 0) + 1);
  }

  for (const [groupId, count] of groupCount) {
    if (count > GUARDRAILS.ACCOUNTS.WARN_PER_GROUP) {
      console.warn(
        `[GUARDRAIL] Account group ${groupId} has ${count} accounts, ` +
          `exceeds threshold (${GUARDRAILS.ACCOUNTS.WARN_PER_GROUP}).`
      );
    }
  }
}
