/**
 * E2E Global Auth Setup
 *
 * Authenticates against local Supabase via the real login UI.
 * Saves session to storageState for all subsequent tests.
 *
 * CTO MANDATE: Real auth, not mocked. "The backend is half the product."
 *
 * Prerequisites:
 * - `supabase start` running on port 54321
 * - `supabase db reset` applied with seed.sql test user
 *
 * @module e2e/auth.setup
 */

import { test as setup, expect } from '@playwright/test';
import { TEST_USER } from './helpers/constants';

/**
 * Warm-up guard: Wait for local Supabase auth to be responsive
 *
 * CTO MANDATE: Prevents CI race condition where Playwright runs
 * before `supabase start` finishes initializing.
 *
 * Retries health check up to 10 times with 2s intervals (20s total).
 */
async function waitForSupabaseAuth(maxRetries = 10): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const healthUrl = `${supabaseUrl}/auth/v1/health`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        console.log(`[Auth Setup] Supabase auth is healthy (attempt ${attempt})`);
        return;
      }
    } catch {
      // Connection refused — Supabase not ready yet
    }

    if (attempt < maxRetries) {
      console.log(`[Auth Setup] Waiting for Supabase auth... (attempt ${attempt}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }

  throw new Error(
    `Supabase auth not responsive after ${maxRetries} attempts. ` +
    'Is `supabase start` running?',
  );
}

setup('authenticate', async ({ page }) => {
  // Step 1: Ensure Supabase is ready before attempting login
  await waitForSupabaseAuth();

  // Step 2: Navigate to login page
  await page.goto('/login');

  // Step 3: Fill credentials and submit
  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByRole('button', { name: /log in/i }).click();

  // Step 4: Wait for redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 15_000 });

  // Step 5: Wait for WatermelonDB to initialize (E2E exposure)
  await page.waitForFunction(
    () => (window as Window & { __watermelondb?: unknown }).__watermelondb !== undefined,
    { timeout: 15_000 },
  );

  // Step 6: Verify we're authenticated and app is functional
  await expect(page.locator('body')).toBeVisible();

  // Step 7: Save authenticated state for all subsequent tests
  await page.context().storageState({ path: 'e2e/.auth/storage-state.json' });

  console.log('[Auth Setup] Authentication complete. StorageState saved.');
});
