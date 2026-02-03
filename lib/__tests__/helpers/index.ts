/**
 * Shared Test Helpers
 *
 * Centralized mock providers and test utilities for the Finance Tracker codebase.
 * Import from `@/lib/__tests__/helpers` in your test files.
 *
 * @example
 * ```typescript
 * import {
 *   createMockSupabase,
 *   createMockAuthProvider,
 *   DEFAULT_TEST_USER_ID,
 * } from '@/lib/__tests__/helpers';
 * ```
 *
 * @module lib/__tests__/helpers
 */

// Mock Supabase Client
export {
  createMockSupabase,
  createMockRpcSuccess,
  createMockRpcError,
  createMockVersionConflictResponse,
  createMockQuerySuccess,
  createMockQueryError,
  type MockQueryBuilder,
  type MockSupabaseClient,
} from './mock-supabase';

// Mock Auth Provider
export {
  createMockAuthProvider,
  DEFAULT_TEST_USER_ID,
  DEFAULT_TEST_USER_EMAIL,
  type MockAuthProviderOptions,
  type MockAuthProvider,
} from './mock-auth';
