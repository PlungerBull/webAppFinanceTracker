/**
 * Playwright Configuration
 *
 * E2E test setup for the Finance Tracker sync conflict resolution flow.
 *
 * CTO MANDATES:
 * - Real local Supabase auth (no mocked endpoints for happy-path tests)
 * - Sequential execution (workers: 1) — shared IndexedDB/WatermelonDB state
 * - Layered conflict seeding via WatermelonDB injection + RPC interception
 *
 * Prerequisites:
 * - `supabase start` (local Supabase on port 54321)
 * - `supabase db reset` (applies migrations + seed.sql)
 *
 * @module playwright.config
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/storage-state.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'NEXT_PUBLIC_E2E=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
