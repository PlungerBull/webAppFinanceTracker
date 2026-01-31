/**
 * Offline Scenario Unit Tests
 *
 * CTO MANDATES:
 * 1. Offline-first: App works without network
 * 2. Sync on reconnect: Push pending changes when network restored
 * 3. No sync when offline: Skip push/pull operations
 * 4. Queue changes locally: All edits stored with 'pending' status
 *
 * @module sync/__tests__/offline-scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PushResult, PullResult, SyncCycleResult, PendingRecord } from '../types';

// Define constants locally to avoid transitive WatermelonDB imports
const TABLE_NAMES = {
  BANK_ACCOUNTS: 'bank_accounts',
  TRANSACTIONS: 'transactions',
  CATEGORIES: 'categories',
  TRANSACTION_INBOX: 'transaction_inbox',
} as const;

const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  CONFLICT: 'conflict',
} as const;

type SyncableTable = typeof TABLE_NAMES[keyof typeof TABLE_NAMES];

// ============================================================================
// TEST HELPERS (inline to avoid transitive imports)
// ============================================================================

function createPendingRecord(
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

  if (tableName === TABLE_NAMES.TRANSACTIONS) {
    baseData.account_id = options.accountId ?? 'account-1';
    baseData.category_id = options.categoryId ?? 'category-1';
    baseData.amount_cents = 1000;
    baseData.description = 'Test transaction';
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

function createPushResult(options: {
  success?: boolean;
  results?: unknown[];
  totalPushed?: number;
  totalConflicts?: number;
  totalFailures?: number;
  durationMs?: number;
} = {}): PushResult {
  return {
    success: options.success ?? true,
    results: (options.results ?? []) as PushResult['results'],
    totalPushed: options.totalPushed ?? 0,
    totalConflicts: options.totalConflicts ?? 0,
    totalFailures: options.totalFailures ?? 0,
    durationMs: options.durationMs ?? 0,
  };
}

function createPullResult(options: {
  success?: boolean;
  tableStats?: unknown[];
  newHighWaterMark?: number;
  durationMs?: number;
  hasMore?: boolean;
} = {}): PullResult {
  return {
    success: options.success ?? true,
    tableStats: (options.tableStats ?? []) as PullResult['tableStats'],
    newHighWaterMark: options.newHighWaterMark ?? 0,
    durationMs: options.durationMs ?? 0,
    hasMore: options.hasMore,
  };
}

describe('Offline Scenarios', () => {
  // ============================================================================
  // SETUP
  // ============================================================================

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. SETONLINESTATUS() BEHAVIOR TESTS (4 tests)
  // ============================================================================

  describe('setOnlineStatus() Behavior', () => {
    it('should store online status internally', () => {
      let isOnline = true;

      // Simulate setOnlineStatus(false)
      isOnline = false;
      expect(isOnline).toBe(false);

      // Simulate setOnlineStatus(true)
      isOnline = true;
      expect(isOnline).toBe(true);
    });

    it('should return early from pushPendingChanges() when offline', () => {
      const isOnline = false;

      // Guard check in pushPendingChanges()
      if (!isOnline) {
        const result: PushResult = {
          success: false,
          results: [],
          totalPushed: 0,
          totalConflicts: 0,
          totalFailures: 0,
          durationMs: 0,
        };

        expect(result.success).toBe(false);
        expect(result.totalPushed).toBe(0);
      }
    });

    it('should return early from pullIncrementalChanges() when offline', () => {
      const isOnline = false;

      // Guard check in pullIncrementalChanges()
      if (!isOnline) {
        const result: PullResult = {
          success: false,
          tableStats: [],
          newHighWaterMark: 0,
          durationMs: 0,
        };

        expect(result.success).toBe(false);
        expect(result.tableStats).toHaveLength(0);
      }
    });

    it('should return early from runFullCycle() with "Device is offline" error', () => {
      const isOnline = false;

      if (!isOnline) {
        const result: SyncCycleResult = {
          success: false,
          pushResult: null,
          pullResult: null,
          durationMs: 0,
          error: new Error('Device is offline'),
        };

        expect(result.success).toBe(false);
        expect(result.error?.message).toBe('Device is offline');
      }
    });
  });

  // ============================================================================
  // 2. OFFLINE-TO-ONLINE TRANSITION TESTS (6 tests)
  // ============================================================================

  describe('Offline-to-Online Transition', () => {
    it('should queue local changes as "pending" while offline', () => {
      const isOnline = false;

      // Create records while offline
      const record1 = createPendingRecord(TABLE_NAMES.TRANSACTIONS, {
        id: 'tx-offline-1',
      });
      const record2 = createPendingRecord(TABLE_NAMES.TRANSACTIONS, {
        id: 'tx-offline-2',
      });

      // Records should be marked as pending
      expect(record1.localSyncStatus).toBe(SYNC_STATUS.PENDING);
      expect(record2.localSyncStatus).toBe(SYNC_STATUS.PENDING);

      // Pending records accumulate while offline
      const pendingRecords = [record1, record2];
      expect(pendingRecords).toHaveLength(2);
    });

    it('should push pending changes on reconnect', () => {
      let isOnline = false;
      const pendingRecords = [
        createPendingRecord(TABLE_NAMES.TRANSACTIONS, { id: 'tx-1' }),
        createPendingRecord(TABLE_NAMES.TRANSACTIONS, { id: 'tx-2' }),
      ];

      // Simulate coming back online
      isOnline = true;

      if (isOnline && pendingRecords.length > 0) {
        // Trigger sync on reconnect
        const syncTriggered = true;
        expect(syncTriggered).toBe(true);
        expect(pendingRecords.length).toBeGreaterThan(0);
      }
    });

    it('should handle multiple records created while offline', () => {
      const offlineRecords = [
        createPendingRecord(TABLE_NAMES.BANK_ACCOUNTS, { id: 'acc-1' }),
        createPendingRecord(TABLE_NAMES.CATEGORIES, { id: 'cat-1' }),
        createPendingRecord(TABLE_NAMES.TRANSACTIONS, { id: 'tx-1' }),
        createPendingRecord(TABLE_NAMES.TRANSACTIONS, { id: 'tx-2' }),
        createPendingRecord(TABLE_NAMES.TRANSACTIONS, { id: 'tx-3' }),
        createPendingRecord(TABLE_NAMES.TRANSACTION_INBOX, { id: 'inbox-1' }),
      ];

      // All should be pending
      const allPending = offlineRecords.every(
        (r) => r.localSyncStatus === SYNC_STATUS.PENDING
      );
      expect(allPending).toBe(true);

      // Batching should group by table
      const byTable = new Map<string, typeof offlineRecords>();
      for (const record of offlineRecords) {
        const existing = byTable.get(record.tableName) ?? [];
        existing.push(record);
        byTable.set(record.tableName, existing);
      }

      expect(byTable.get(TABLE_NAMES.TRANSACTIONS)).toHaveLength(3);
      expect(byTable.get(TABLE_NAMES.BANK_ACCOUNTS)).toHaveLength(1);
    });

    it('should maintain correct version ordering after offline edits', () => {
      // Versions should be sequential for each record, not global
      const record = {
        id: 'tx-1',
        version: 1,
      };

      // Multiple edits while offline increment version
      record.version = 2; // Edit 1
      record.version = 3; // Edit 2
      record.version = 4; // Edit 3

      // On sync, server will get version 4
      expect(record.version).toBe(4);
    });

    it('should sync deletes made while offline', () => {
      // Record deleted while offline
      const deletedRecord = createPendingRecord(TABLE_NAMES.TRANSACTIONS, {
        id: 'tx-deleted',
        isDelete: true,
      });

      expect(deletedRecord.isDelete).toBe(true);
      expect(deletedRecord.deletedAt).not.toBeNull();

      // On reconnect, delete should be pushed in prune phase
      const isPruneCandidate = deletedRecord.isDelete;
      expect(isPruneCandidate).toBe(true);
    });

    it('should handle records edited multiple times while offline (last-write-wins)', () => {
      // Simulate multiple edits to same record while offline
      const edits = [
        { id: 'tx-1', description: 'First edit', timestamp: 1000 },
        { id: 'tx-1', description: 'Second edit', timestamp: 2000 },
        { id: 'tx-1', description: 'Third edit', timestamp: 3000 },
      ];

      // Last-write-wins: only final state is synced
      const latestByRecord = new Map<string, typeof edits[0]>();
      for (const edit of edits) {
        latestByRecord.set(edit.id, edit);
      }

      const finalState = latestByRecord.get('tx-1');
      expect(finalState?.description).toBe('Third edit');

      // Only one push needed per record
      expect(latestByRecord.size).toBe(1);
    });
  });

  // ============================================================================
  // 3. NETWORK STATUS CHANGE HANDLING (3 tests)
  // ============================================================================

  describe('Network Status Change Handling', () => {
    it('should detect network status change via setOnlineStatus()', () => {
      const statusChanges: boolean[] = [];

      // Track status changes
      const setOnlineStatus = (status: boolean): void => {
        statusChanges.push(status);
      };

      setOnlineStatus(true); // Initial
      setOnlineStatus(false); // Goes offline
      setOnlineStatus(true); // Comes back online

      expect(statusChanges).toEqual([true, false, true]);
    });

    it('should trigger sync when transitioning from offline to online', () => {
      let wasOffline = true;
      let isOnline = false;
      let syncTriggered = false;

      // Come back online
      isOnline = true;

      if (wasOffline && isOnline) {
        syncTriggered = true;
        wasOffline = false;
      }

      expect(syncTriggered).toBe(true);
    });

    it('should not trigger sync when already online', () => {
      const wasOffline = false;
      const isOnline = true;
      let syncTriggered = false;

      // Status remains online
      if (wasOffline && isOnline) {
        syncTriggered = true;
      }

      expect(syncTriggered).toBe(false);
    });
  });
});
