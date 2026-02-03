/**
 * Mock Supabase Client Factory
 *
 * Provides reusable mock Supabase clients for testing repositories and services.
 * Use `@/` path aliases when importing this in tests.
 *
 * @example
 * ```typescript
 * import { createMockSupabase, createMockRpcResponse } from '@/lib/__tests__/helpers';
 *
 * const { supabase, mockFrom, mockRpc } = createMockSupabase();
 * mockRpc.mockResolvedValue(createMockRpcResponse({ success: true }));
 * ```
 *
 * @module lib/__tests__/helpers/mock-supabase
 */

import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Mock query builder for Supabase `from()` calls
 */
export interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

/**
 * Mock Supabase client return type
 */
export interface MockSupabaseClient {
  supabase: Partial<SupabaseClient<Database>>;
  mockFrom: ReturnType<typeof vi.fn>;
  mockRpc: ReturnType<typeof vi.fn>;
  createQueryBuilder: () => MockQueryBuilder;
}

/**
 * Create a mock Supabase client for testing
 *
 * @returns Mock client with mockFrom and mockRpc functions
 *
 * @example
 * ```typescript
 * const { supabase, mockRpc } = createMockSupabase();
 * mockRpc.mockResolvedValue({ data: { success: true }, error: null });
 *
 * const repository = new SomeRepository(supabase as SupabaseClient<Database>);
 * ```
 */
export function createMockSupabase(): MockSupabaseClient {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();

  const createQueryBuilder = (): MockQueryBuilder => {
    const builder: MockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    return builder;
  };

  const supabase = {
    from: mockFrom,
    rpc: mockRpc,
  };

  return {
    supabase,
    mockFrom,
    mockRpc,
    createQueryBuilder,
  };
}

/**
 * Create a mock RPC success response
 */
export function createMockRpcSuccess<T>(data: T): { data: T; error: null } {
  return { data, error: null };
}

/**
 * Create a mock RPC error response
 */
export function createMockRpcError(
  message: string,
  code: string = 'PGRST000'
): { data: null; error: { message: string; code: string; details: string; hint: string } } {
  return {
    data: null,
    error: { message, code, details: '', hint: '' },
  };
}

/**
 * Create a mock version conflict RPC response (P0001 code)
 */
export function createMockVersionConflictResponse(): {
  data: null;
  error: { message: string; code: string; details: string; hint: string };
} {
  return createMockRpcError('Version conflict', 'P0001');
}

/**
 * Create a mock query success response
 */
export function createMockQuerySuccess<T>(data: T): { data: T; error: null } {
  return { data, error: null };
}

/**
 * Create a mock query error response
 */
export function createMockQueryError(message: string): { data: null; error: { message: string } } {
  return { data: null, error: { message } };
}
