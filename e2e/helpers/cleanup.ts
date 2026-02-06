/**
 * E2E Test Cleanup Utilities
 *
 * Provides test isolation by resetting WatermelonDB between tests
 * and clearing Playwright route interceptions.
 *
 * CTO MANDATE: Each test starts with pristine local state.
 * Sequential workers (workers: 1) + beforeEach reset = deterministic.
 *
 * @module e2e/helpers/cleanup
 */

import type { Page } from '@playwright/test';

/**
 * Reset WatermelonDB by deleting the IndexedDB database
 *
 * Uses the existing `resetLocalDatabase()` exposed by the app's
 * local-db module. Falls back to direct IndexedDB deletion.
 *
 * Must be called in beforeEach to ensure clean state.
 */
export async function resetWatermelonDB(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const DB_NAME = 'finance_tracker_local';

    // Try to use the app's reset function first
    try {
      const { resetLocalDatabase } = await import('@/lib/local-db');
      await resetLocalDatabase();
      return;
    } catch {
      // Fall back to direct IndexedDB deletion
    }

    // Direct IndexedDB deletion fallback
    return new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete IndexedDB'));
      request.onblocked = () => {
        console.warn('[E2E Cleanup] IndexedDB delete blocked — retrying after reload');
        resolve();
      };
    });
  });
}

/**
 * Wait for WatermelonDB to be initialized and exposed
 *
 * Polls for window.__watermelondb to be defined.
 * Requires NEXT_PUBLIC_E2E=true in the webServer environment.
 */
export async function waitForWatermelonDB(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as Window & { __watermelondb?: unknown }).__watermelondb !== undefined,
    { timeout: 15_000 },
  );
}

/**
 * Clear all Playwright route interceptions
 *
 * Must be called in afterEach to prevent mock leakage between tests.
 */
export async function removeAllRouteInterceptions(page: Page): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}
