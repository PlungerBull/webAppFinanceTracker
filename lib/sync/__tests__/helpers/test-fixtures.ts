/**
 * Test Fixtures for Sync Engine Tests
 *
 * CTO MANDATES:
 * - Version Conflict Simulator for 409 testing
 * - Clock Skew Simulator for temporal invariance
 * - Failed Parent ID Tracker for chain failure isolation
 *
 * @module sync/__tests__/helpers/test-fixtures
 */

import type {
  PendingRecord,
  TableBatchResult,
  BatchPushResult,
  PushResult,
  PullResult,
  SyncCycleResult,
  ConflictRecord,
  ChangesResponse,
  SyncConfig,
} from '../../types';
import type { SyncableTable } from '@/lib/local-db/schema';
import { TABLE_NAMES, SYNC_STATUS } from '@/lib/local-db';
import { DEFAULT_SYNC_CONFIG } from '../../constants';

// ============================================================================
// MOCK RECORD CREATORS
// ============================================================================

/**
 * Create mock records with sequential versions
 *
 * Follows pattern from pull-engine.test.ts
 */
export function createMockRecords(
  count: number,
  startVersion: number,
  options: {
    includeDeleted?: number;
    tableName?: SyncableTable;
    userId?: string;
    syncStatus?: string;
  } = {}
): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = [];
  const tableName = options.tableName ?? TABLE_NAMES.TRANSACTIONS;
  const userId = options.userId ?? 'test-user';
  const syncStatus = options.syncStatus ?? SYNC_STATUS.SYNCED;

  for (let i = 0; i < count; i++) {
    const version = startVersion + i;
    const isDeleted =
      options.includeDeleted !== undefined && i < options.includeDeleted;
    records.push({
      id: `id-${version}`,
      version,
      deleted_at: isDeleted ? new Date().toISOString() : null,
      deletedAt: isDeleted ? Date.now() : null,
      name: `Record ${version}`,
      user_id: userId,
      userId: userId,
      localSyncStatus: syncStatus,
      local_sync_status: syncStatus,
      tableName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  return records;
}

/**
 * Create a pending record for push operations
 */
export function createPendingRecord(
  tableName: SyncableTable,
  options: {
    id?: string;
    version?: number;
    isDelete?: boolean;
    accountId?: string;
    categoryId?: string;
    userId?: string;
  } = {}
): PendingRecord {
  const id = options.id ?? `pending-${Math.random().toString(36).slice(2)}`;
  const version = options.version ?? 1;
  const isDelete = options.isDelete ?? false;
  const userId = options.userId ?? 'test-user';

  const baseData: Record<string, unknown> = {
    id,
    user_id: userId,
    version,
    deleted_at: isDelete ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Add table-specific fields
  if (tableName === TABLE_NAMES.TRANSACTIONS) {
    baseData.account_id = options.accountId ?? 'account-1';
    baseData.category_id = options.categoryId ?? 'category-1';
    baseData.amount_cents = 1000;
    baseData.description = 'Test transaction';
  } else if (tableName === TABLE_NAMES.BANK_ACCOUNTS) {
    baseData.name = 'Test Account';
    baseData.type = 'checking';
    baseData.currency_code = 'USD';
  } else if (tableName === TABLE_NAMES.CATEGORIES) {
    baseData.name = 'Test Category';
    baseData.type = 'expense';
  } else if (tableName === TABLE_NAMES.TRANSACTION_INBOX) {
    baseData.account_id = options.accountId ?? 'account-1';
    baseData.category_id = options.categoryId ?? null;
    baseData.amount_cents = 500;
    baseData.description = 'Inbox item';
    baseData.status = 'pending';
  }

  return {
    id,
    tableName,
    localSyncStatus: SYNC_STATUS.PENDING,
    version,
    deletedAt: isDelete ? Date.now() : null,
    isDelete,
    data: baseData,
  };
}

// ============================================================================
// RPC RESPONSE MOCKS
// ============================================================================

/**
 * Create a TableBatchResult for RPC response
 */
export function createTableBatchResult(options: {
  syncedIds?: string[];
  conflictIds?: string[];
  errorMap?: Record<string, string>;
}): TableBatchResult {
  return {
    synced_ids: options.syncedIds ?? [],
    conflict_ids: options.conflictIds ?? [],
    error_map: options.errorMap ?? {},
  };
}

/**
 * CTO MANDATORY: Version Conflict Simulator
 *
 * Creates an RPC response indicating a 409 conflict for the given record.
 * Used to verify MutationResult returns buffered: true with Projected Data.
 */
export function createConflictResponse(
  serverId: string,
  serverVersion: number
): { data: TableBatchResult; error: null } {
  return {
    data: {
      synced_ids: [],
      conflict_ids: [serverId],
      error_map: {},
    },
    error: null,
  };
}

/**
 * Create a successful RPC response
 */
export function createSuccessResponse(
  syncedIds: string[]
): { data: TableBatchResult; error: null } {
  return {
    data: {
      synced_ids: syncedIds,
      conflict_ids: [],
      error_map: {},
    },
    error: null,
  };
}

/**
 * Create an error RPC response
 */
export function createErrorResponse(
  errorMessage: string
): { data: null; error: { message: string; code: string } } {
  return {
    data: null,
    error: { message: errorMessage, code: 'PGRST000' },
  };
}

/**
 * Create a partial failure response (some succeed, some fail)
 */
export function createPartialFailureResponse(options: {
  syncedIds?: string[];
  conflictIds?: string[];
  errorMap?: Record<string, string>;
}): { data: TableBatchResult; error: null } {
  return {
    data: createTableBatchResult(options),
    error: null,
  };
}

/**
 * Create ChangesResponse for pull operations
 */
export function createChangesResponse(
  records: Array<Record<string, unknown>>
): ChangesResponse {
  return { records };
}

// ============================================================================
// MOCK SUPABASE RPC
// ============================================================================

type RpcResponse = { data: unknown; error: unknown };
type RpcHandler = (params: Record<string, unknown>) => RpcResponse;

/**
 * Create a mock Supabase client with configurable RPC responses
 */
export function createMockSupabaseRpc(
  responses: Record<string, RpcResponse | RpcHandler>
): {
  supabase: { rpc: ReturnType<typeof vi.fn> };
  getCallHistory: () => Array<{ name: string; params: unknown }>;
  setResponse: (rpcName: string, response: RpcResponse | RpcHandler) => void;
} {
  const callHistory: Array<{ name: string; params: unknown }> = [];
  const responseMap = new Map<string, RpcResponse | RpcHandler>(
    Object.entries(responses)
  );

  const mockRpc = vi.fn().mockImplementation((name: string, params: unknown) => {
    callHistory.push({ name, params });
    const response = responseMap.get(name);
    if (typeof response === 'function') {
      return response(params as Record<string, unknown>);
    }
    return response ?? { data: null, error: { message: 'Unknown RPC', code: 'UNKNOWN' } };
  });

  return {
    supabase: { rpc: mockRpc },
    getCallHistory: () => callHistory,
    setResponse: (rpcName: string, response: RpcResponse | RpcHandler) => {
      responseMap.set(rpcName, response);
    },
  };
}

// ============================================================================
// CTO MANDATORY: Clock Skew Simulator
// ============================================================================

/**
 * CTO MANDATORY: Clock Skew Simulator
 *
 * Mocks Date.now() to return a specific timestamp.
 * Returns cleanup function to restore original Date.now().
 *
 * Usage:
 *   const restore = mockDateNow(new Date('1999-01-01').getTime());
 *   // ... run tests ...
 *   restore();
 */
export function mockDateNow(timestamp: number): () => void {
  const originalDateNow = Date.now;
  Date.now = () => timestamp;
  return () => {
    Date.now = originalDateNow;
  };
}

/**
 * CTO MANDATORY: Mock Date constructor for full temporal isolation
 */
export function mockDateConstructor(fixedDate: Date): () => void {
  const OriginalDate = globalThis.Date;
  const timestamp = fixedDate.getTime();

  // @ts-expect-error - Mocking global Date
  globalThis.Date = class extends OriginalDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(timestamp);
      } else {
        // @ts-expect-error - spread args
        super(...args);
      }
    }

    static now(): number {
      return timestamp;
    }
  };

  return () => {
    globalThis.Date = OriginalDate;
  };
}

// ============================================================================
// CTO MANDATORY: Failed Parent ID Tracker
// ============================================================================

export interface FailedParentTracker {
  addFailedAccount(id: string): void;
  addFailedCategory(id: string): void;
  shouldSkipTransaction(accountId: string, categoryId: string | null): boolean;
  getFailedAccountIds(): string[];
  getFailedCategoryIds(): string[];
  clear(): void;
}

/**
 * CTO MANDATORY: Failed Parent ID Tracker
 *
 * Tracks failed parent entities during push to prevent orphaned FK references.
 * If an Account or Category fails to push, their dependent Transactions
 * must be skipped in the same sync cycle.
 */
export function createFailedParentTracker(): FailedParentTracker {
  const failedAccountIds = new Set<string>();
  const failedCategoryIds = new Set<string>();

  return {
    addFailedAccount(id: string): void {
      failedAccountIds.add(id);
    },

    addFailedCategory(id: string): void {
      failedCategoryIds.add(id);
    },

    shouldSkipTransaction(accountId: string, categoryId: string | null): boolean {
      if (failedAccountIds.has(accountId)) {
        return true;
      }
      if (categoryId && failedCategoryIds.has(categoryId)) {
        return true;
      }
      return false;
    },

    getFailedAccountIds(): string[] {
      return Array.from(failedAccountIds);
    },

    getFailedCategoryIds(): string[] {
      return Array.from(failedCategoryIds);
    },

    clear(): void {
      failedAccountIds.clear();
      failedCategoryIds.clear();
    },
  };
}

// ============================================================================
// MOCK DATABASE
// ============================================================================

export interface MockCollection {
  query: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
}

export interface MockDatabase {
  get: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock WatermelonDB database
 */
export function createMockDatabase(
  records: Map<string, Map<string, Record<string, unknown>>> = new Map()
): MockDatabase {
  const collections = new Map<string, MockCollection>();

  const createCollection = (tableName: string): MockCollection => {
    const tableRecords = records.get(tableName) ?? new Map();

    const mockQuery = vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue(Array.from(tableRecords.values())),
      fetchCount: vi.fn().mockResolvedValue(tableRecords.size),
    });

    const mockFind = vi.fn().mockImplementation((id: string) => {
      const record = tableRecords.get(id);
      if (!record) {
        return Promise.reject(new Error(`Record not found: ${id}`));
      }
      return Promise.resolve({
        ...record,
        _raw: record,
        update: vi.fn().mockImplementation((callback: (r: unknown) => void) => {
          callback(record);
          return Promise.resolve();
        }),
      });
    });

    return {
      query: mockQuery,
      find: mockFind,
    };
  };

  return {
    get: vi.fn().mockImplementation((tableName: string) => {
      if (!collections.has(tableName)) {
        collections.set(tableName, createCollection(tableName));
      }
      return collections.get(tableName);
    }),
    write: vi.fn().mockImplementation((callback: () => Promise<void>) => callback()),
  };
}

// ============================================================================
// RESULT BUILDERS
// ============================================================================

/**
 * Create a BatchPushResult
 */
export function createBatchPushResult(
  tableName: SyncableTable,
  options: {
    successCount?: number;
    conflictCount?: number;
    errorCount?: number;
    syncedIds?: string[];
    conflictIds?: string[];
    failedIds?: Array<{ id: string; error: string }>;
  } = {}
): BatchPushResult {
  return {
    tableName,
    successCount: options.successCount ?? options.syncedIds?.length ?? 0,
    conflictCount: options.conflictCount ?? options.conflictIds?.length ?? 0,
    errorCount: options.errorCount ?? options.failedIds?.length ?? 0,
    syncedIds: options.syncedIds ?? [],
    conflictIds: options.conflictIds ?? [],
    failedIds: options.failedIds ?? [],
    serverVersions: new Map(),
  };
}

/**
 * Create a PushResult
 */
export function createPushResult(options: {
  success?: boolean;
  results?: BatchPushResult[];
  totalPushed?: number;
  totalConflicts?: number;
  totalFailures?: number;
  durationMs?: number;
} = {}): PushResult {
  return {
    success: options.success ?? true,
    results: options.results ?? [],
    totalPushed: options.totalPushed ?? 0,
    totalConflicts: options.totalConflicts ?? 0,
    totalFailures: options.totalFailures ?? 0,
    durationMs: options.durationMs ?? 0,
  };
}

/**
 * Create a PullResult
 */
export function createPullResult(options: {
  success?: boolean;
  tableStats?: Array<{ tableName: SyncableTable; upsertCount: number; tombstoneCount: number }>;
  newHighWaterMark?: number;
  durationMs?: number;
  hasMore?: boolean;
} = {}): PullResult {
  return {
    success: options.success ?? true,
    tableStats: options.tableStats ?? [],
    newHighWaterMark: options.newHighWaterMark ?? 0,
    durationMs: options.durationMs ?? 0,
    hasMore: options.hasMore,
  };
}

/**
 * Create a SyncCycleResult
 */
export function createSyncCycleResult(options: {
  success?: boolean;
  pushResult?: PushResult | null;
  pullResult?: PullResult | null;
  durationMs?: number;
  error?: Error;
} = {}): SyncCycleResult {
  return {
    success: options.success ?? true,
    pushResult: options.pushResult ?? null,
    pullResult: options.pullResult ?? null,
    durationMs: options.durationMs ?? 0,
    error: options.error,
  };
}

/**
 * Create a ConflictRecord
 */
export function createConflictRecord(
  tableName: SyncableTable,
  options: {
    id?: string;
    localVersion?: number;
    serverVersion?: number;
  } = {}
): ConflictRecord {
  const id = options.id ?? `conflict-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    tableName,
    localData: { id, name: 'Local version' },
    serverData: { id, name: 'Server version' },
    localVersion: options.localVersion ?? 1,
    serverVersion: options.serverVersion ?? 2,
    detectedAt: new Date().toISOString(),
  };
}

// ============================================================================
// CONFIG HELPERS
// ============================================================================

/**
 * Create a test config with overrides
 */
export function createTestConfig(overrides: Partial<SyncConfig> = {}): SyncConfig {
  return {
    ...DEFAULT_SYNC_CONFIG,
    ...overrides,
  };
}

// ============================================================================
// VI MOCK IMPORT (for type safety)
// ============================================================================

// Import vi from vitest for mock creation
import { vi } from 'vitest';
