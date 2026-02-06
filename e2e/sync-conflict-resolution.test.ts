/**
 * E2E: Sync Conflict Resolution Tests
 *
 * Tests the complete user flow for resolving sync conflicts:
 * Banner appears → User clicks "Review Issues" → Modal opens →
 * User retries/deletes conflicts → Modal closes → Banner disappears.
 *
 * CTO MANDATES:
 * - Real local Supabase auth (via storageState from auth.setup.ts)
 * - Layered seeding: WatermelonDB injection (Layer 1) + RPC interception (Layer 2)
 * - test.step() for readable "Offline Actions" vs "Reconnection/Sync" logs
 * - Mocking only for negative tests (500, 429)
 *
 * @module e2e/sync-conflict-resolution.test
 */

import { test, expect } from '@playwright/test';
import {
  resetWatermelonDB,
  waitForWatermelonDB,
  removeAllRouteInterceptions,
} from './helpers/cleanup';
import {
  seedConflictScenario,
  getRecordSyncStatus,
  interceptBatchUpsertWithServerError,
} from './helpers/sync-test-harness';
import {
  TEST_RECORDS,
  SYNC_ERROR_MESSAGES,
  BATCH_UPSERT_RPC_NAMES,
} from './helpers/constants';

// ============================================================================
// TEST LIFECYCLE
// ============================================================================

test.describe('Sync Conflict Resolution', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (storageState provides auth)
    await page.goto('/dashboard');

    // Wait for WatermelonDB to initialize
    await waitForWatermelonDB(page);

    // Reset local database for pristine state
    await resetWatermelonDB(page);

    // Reload to reinitialize WatermelonDB with clean state
    await page.reload();
    await waitForWatermelonDB(page);
  });

  test.afterEach(async ({ page }) => {
    await removeAllRouteInterceptions(page);
  });

  // ==========================================================================
  // TEST 1: Conflict banner appears when WatermelonDB has conflict records
  // ==========================================================================

  test('conflict banner appears when conflicts exist', async ({ page }) => {
    await test.step('Seed conflict records into WatermelonDB', async () => {
      await seedConflictScenario(page, {
        table: 'bank_accounts',
        recordId: TEST_RECORDS.CONFLICTED_ACCOUNT.id,
        localData: TEST_RECORDS.CONFLICTED_ACCOUNT,
      });

      await seedConflictScenario(page, {
        table: 'transactions',
        recordId: TEST_RECORDS.CONFLICTED_TRANSACTION.id,
        localData: {
          ...TEST_RECORDS.CONFLICTED_TRANSACTION,
          date: Date.now(),
        },
      });
    });

    await test.step('Reload to trigger conflict count update', async () => {
      await page.reload();
      await waitForWatermelonDB(page);
    });

    await test.step('Verify banner appears with correct count', async () => {
      const banner = page.locator('text=items could not be synced');
      await expect(banner).toBeVisible({ timeout: 10_000 });

      const reviewButton = page.getByRole('button', { name: /review issues/i });
      await expect(reviewButton).toBeVisible();
    });
  });

  // ==========================================================================
  // TEST 2: Conflict modal opens with correct data
  // ==========================================================================

  test('modal opens with correct conflict data', async ({ page }) => {
    await test.step('Seed 2 conflict records (account + transaction)', async () => {
      await seedConflictScenario(page, {
        table: 'bank_accounts',
        recordId: TEST_RECORDS.CONFLICTED_ACCOUNT.id,
        localData: TEST_RECORDS.CONFLICTED_ACCOUNT,
      });

      await seedConflictScenario(page, {
        table: 'transactions',
        recordId: TEST_RECORDS.CONFLICTED_TRANSACTION.id,
        localData: {
          ...TEST_RECORDS.CONFLICTED_TRANSACTION,
          date: Date.now(),
        },
        syncError: SYNC_ERROR_MESSAGES.VALIDATION_FAILED,
      });
    });

    await test.step('Reload and open modal', async () => {
      await page.reload();
      await waitForWatermelonDB(page);

      // Wait for banner and click "Review Issues"
      const reviewButton = page.getByRole('button', { name: /review issues/i });
      await expect(reviewButton).toBeVisible({ timeout: 10_000 });
      await reviewButton.click();
    });

    await test.step('Verify modal content', async () => {
      // Modal title
      const modalTitle = page.locator('text=Sync Issues');
      await expect(modalTitle).toBeVisible();

      // Account conflict
      const accountBadge = page.locator('text=Account');
      await expect(accountBadge).toBeVisible();

      const accountName = page.locator('text=Test Checking Account');
      await expect(accountName).toBeVisible();

      // Transaction conflict
      const transactionBadge = page.locator('text=Transaction');
      await expect(transactionBadge).toBeVisible();

      const transactionDesc = page.locator('text=Conflicted Grocery Purchase');
      await expect(transactionDesc).toBeVisible();

      // Sync error message
      const validationError = page.locator(
        `text=${SYNC_ERROR_MESSAGES.VALIDATION_FAILED}`,
      );
      await expect(validationError).toBeVisible();
    });
  });

  // ==========================================================================
  // TEST 3: Retry resets conflict to pending and triggers sync
  // ==========================================================================

  test('retry button resets conflict to pending', async ({ page }) => {
    const recordId = TEST_RECORDS.CONFLICTED_ACCOUNT.id;

    await test.step('Seed 1 conflict record', async () => {
      await seedConflictScenario(page, {
        table: 'bank_accounts',
        recordId,
        localData: TEST_RECORDS.CONFLICTED_ACCOUNT,
      });
    });

    await test.step('Reload and open modal', async () => {
      await page.reload();
      await waitForWatermelonDB(page);

      const reviewButton = page.getByRole('button', { name: /review issues/i });
      await expect(reviewButton).toBeVisible({ timeout: 10_000 });
      await reviewButton.click();

      // Wait for modal to load conflicts
      await expect(page.locator('text=Test Checking Account')).toBeVisible();
    });

    await test.step('Click retry button on the conflict', async () => {
      // The retry button is a ghost button with a RefreshCw icon
      // It's the first action button (before delete) in each conflict row
      const conflictRow = page.locator('li').filter({ hasText: 'Test Checking Account' });
      const retryButton = conflictRow.locator('button').filter({ hasText: '' }).first();
      await retryButton.click();
    });

    await test.step('Verify retry result', async () => {
      // Toast should appear
      const toast = page.locator('text=Retry queued');
      await expect(toast).toBeVisible({ timeout: 5_000 });

      // Item should be removed from the modal list
      await expect(page.locator('text=Test Checking Account')).not.toBeVisible();
    });

    await test.step('Verify WatermelonDB record state', async () => {
      const status = await getRecordSyncStatus(page, 'bank_accounts', recordId);
      // After retry, record should be 'pending' (or deleted if modal closed)
      // The retryConflict action sets status to 'pending'
      if (status) {
        expect(status.localSyncStatus).toBe('pending');
        expect(status.syncError).toBeNull();
      }
    });
  });

  // ==========================================================================
  // TEST 4: Delete discards local record with confirmation
  // ==========================================================================

  test('delete button shows confirmation and discards local record', async ({ page }) => {
    const recordId = TEST_RECORDS.CONFLICTED_ACCOUNT.id;

    await test.step('Seed 1 conflict record', async () => {
      await seedConflictScenario(page, {
        table: 'bank_accounts',
        recordId,
        localData: TEST_RECORDS.CONFLICTED_ACCOUNT,
      });
    });

    await test.step('Reload and open modal', async () => {
      await page.reload();
      await waitForWatermelonDB(page);

      const reviewButton = page.getByRole('button', { name: /review issues/i });
      await expect(reviewButton).toBeVisible({ timeout: 10_000 });
      await reviewButton.click();

      await expect(page.locator('text=Test Checking Account')).toBeVisible();
    });

    await test.step('Click delete button to open confirmation', async () => {
      const conflictRow = page.locator('li').filter({ hasText: 'Test Checking Account' });
      const deleteButton = conflictRow.locator('button').filter({ hasText: '' }).last();
      await deleteButton.click();
    });

    await test.step('Verify confirmation dialog', async () => {
      const confirmTitle = page.locator('text=Discard Local Changes?');
      await expect(confirmTitle).toBeVisible();

      const warningText = page.locator('text=This action cannot be undone');
      await expect(warningText).toBeVisible();
    });

    await test.step('Confirm deletion', async () => {
      const discardButton = page.getByRole('button', { name: /discard local/i });
      await discardButton.click();
    });

    await test.step('Verify deletion result', async () => {
      // Toast should appear
      const toast = page.locator('text=Conflict resolved');
      await expect(toast).toBeVisible({ timeout: 5_000 });

      // Modal should close (was the last conflict)
      await expect(page.locator('text=Sync Issues')).not.toBeVisible({ timeout: 5_000 });

      // Banner should disappear
      await expect(page.locator('text=could not be synced')).not.toBeVisible({ timeout: 5_000 });
    });

    await test.step('Verify record is removed from WatermelonDB', async () => {
      const status = await getRecordSyncStatus(page, 'bank_accounts', recordId);
      expect(status).toBeNull();
    });
  });

  // ==========================================================================
  // TEST 5: "Retry Sync" button triggers full sync cycle
  // ==========================================================================

  test('"Retry Sync" button triggers full sync cycle', async ({ page }) => {
    await test.step('Seed 2 conflict records', async () => {
      await seedConflictScenario(page, {
        table: 'bank_accounts',
        recordId: TEST_RECORDS.CONFLICTED_ACCOUNT.id,
        localData: TEST_RECORDS.CONFLICTED_ACCOUNT,
      });

      await seedConflictScenario(page, {
        table: 'transactions',
        recordId: TEST_RECORDS.CONFLICTED_TRANSACTION.id,
        localData: {
          ...TEST_RECORDS.CONFLICTED_TRANSACTION,
          date: Date.now(),
        },
      });
    });

    await test.step('Reload and open modal', async () => {
      await page.reload();
      await waitForWatermelonDB(page);

      const reviewButton = page.getByRole('button', { name: /review issues/i });
      await expect(reviewButton).toBeVisible({ timeout: 10_000 });
      await reviewButton.click();

      await expect(page.locator('text=Sync Issues')).toBeVisible();
    });

    await test.step('Click "Retry Sync" and verify loading state', async () => {
      const retrySyncButton = page.getByRole('button', { name: /retry sync/i });
      await retrySyncButton.click();

      // Button should show loading state
      const retryingText = page.locator('text=Retrying...');
      await expect(retryingText).toBeVisible({ timeout: 3_000 });
    });

    await test.step('Wait for sync to complete', async () => {
      // After sync, the Retry Sync button should be re-enabled
      const retrySyncButton = page.getByRole('button', { name: /retry sync/i });
      await expect(retrySyncButton).toBeEnabled({ timeout: 30_000 });
    });
  });

  // ==========================================================================
  // TEST 6: Modal closes when all conflicts are individually resolved
  // ==========================================================================

  test('modal closes when all conflicts are resolved', async ({ page }) => {
    await test.step('Seed 2 conflict records', async () => {
      await seedConflictScenario(page, {
        table: 'bank_accounts',
        recordId: TEST_RECORDS.CONFLICTED_ACCOUNT.id,
        localData: TEST_RECORDS.CONFLICTED_ACCOUNT,
      });

      await seedConflictScenario(page, {
        table: 'transactions',
        recordId: TEST_RECORDS.CONFLICTED_TRANSACTION.id,
        localData: {
          ...TEST_RECORDS.CONFLICTED_TRANSACTION,
          date: Date.now(),
        },
      });
    });

    await test.step('Reload and open modal', async () => {
      await page.reload();
      await waitForWatermelonDB(page);

      const reviewButton = page.getByRole('button', { name: /review issues/i });
      await expect(reviewButton).toBeVisible({ timeout: 10_000 });
      await reviewButton.click();

      await expect(page.locator('text=Sync Issues')).toBeVisible();
    });

    await test.step('Retry first conflict (account)', async () => {
      const accountRow = page.locator('li').filter({ hasText: 'Test Checking Account' });
      const retryButton = accountRow.locator('button').first();
      await retryButton.click();

      // Wait for item to be removed
      await expect(page.locator('text=Test Checking Account')).not.toBeVisible({
        timeout: 5_000,
      });
    });

    await test.step('Delete second conflict (transaction)', async () => {
      const txnRow = page.locator('li').filter({ hasText: 'Conflicted Grocery Purchase' });
      const deleteButton = txnRow.locator('button').last();
      await deleteButton.click();

      // Confirm deletion
      const discardButton = page.getByRole('button', { name: /discard local/i });
      await expect(discardButton).toBeVisible();
      await discardButton.click();
    });

    await test.step('Verify modal and banner both close', async () => {
      // Modal should close automatically
      await expect(page.locator('text=Sync Issues')).not.toBeVisible({ timeout: 5_000 });

      // Banner should disappear
      await expect(page.locator('text=could not be synced')).not.toBeVisible({
        timeout: 5_000,
      });
    });
  });

  // ==========================================================================
  // TEST 7: [Negative] Network error during retry is handled gracefully
  // ==========================================================================

  test('[Negative] handles network error during retry gracefully', async ({ page }) => {
    const recordId = TEST_RECORDS.CONFLICTED_ACCOUNT.id;

    await test.step('Seed 1 conflict record', async () => {
      await seedConflictScenario(page, {
        table: 'bank_accounts',
        recordId,
        localData: TEST_RECORDS.CONFLICTED_ACCOUNT,
      });
    });

    await test.step('Reload and open modal', async () => {
      await page.reload();
      await waitForWatermelonDB(page);

      const reviewButton = page.getByRole('button', { name: /review issues/i });
      await expect(reviewButton).toBeVisible({ timeout: 10_000 });
      await reviewButton.click();

      await expect(page.locator('text=Test Checking Account')).toBeVisible();
    });

    await test.step('Intercept sync RPC with 500 error (CTO-approved negative test)', async () => {
      await interceptBatchUpsertWithServerError(
        page,
        BATCH_UPSERT_RPC_NAMES.bank_accounts,
      );
    });

    await test.step('Click "Retry Sync" to trigger sync cycle with server error', async () => {
      const retrySyncButton = page.getByRole('button', { name: /retry sync/i });
      await retrySyncButton.click();
    });

    await test.step('Verify error is handled gracefully', async () => {
      // Wait for sync attempt to complete
      const retrySyncButton = page.getByRole('button', { name: /retry sync/i });
      await expect(retrySyncButton).toBeEnabled({ timeout: 30_000 });

      // The conflict should remain in the list (not cleared by failed sync)
      const accountItem = page.locator('text=Test Checking Account');
      await expect(accountItem).toBeVisible();
    });
  });
});
