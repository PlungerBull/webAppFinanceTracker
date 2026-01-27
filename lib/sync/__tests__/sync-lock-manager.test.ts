/**
 * Sync Lock Manager Unit Tests
 *
 * CTO MANDATE: Mutation Locking During Sync
 * Tests verify that:
 * 1. Records can be locked/unlocked
 * 2. isLocked() correctly identifies locked records
 * 3. checkAndBufferIfLocked() buffers updates for locked records
 * 4. flushBuffer() returns and clears buffered updates
 *
 * @module sync/__tests__/sync-lock-manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SyncLockManager,
  getSyncLockManager,
  resetSyncLockManager,
  checkAndBufferIfLocked,
} from '../sync-lock-manager';

describe('SyncLockManager', () => {
  let lockManager: SyncLockManager;

  beforeEach(() => {
    // Reset singleton before each test
    resetSyncLockManager();
    lockManager = getSyncLockManager();
  });

  describe('lockRecords / unlockRecords', () => {
    it('should lock and unlock records', () => {
      expect(lockManager.isLocked('id1')).toBe(false);

      lockManager.lockRecords(['id1', 'id2']);
      expect(lockManager.isLocked('id1')).toBe(true);
      expect(lockManager.isLocked('id2')).toBe(true);
      expect(lockManager.isLocked('id3')).toBe(false);

      lockManager.unlockRecords(['id1']);
      expect(lockManager.isLocked('id1')).toBe(false);
      expect(lockManager.isLocked('id2')).toBe(true);

      lockManager.unlockRecords(['id2']);
      expect(lockManager.isLocked('id2')).toBe(false);
    });

    it('should report correct locked count', () => {
      expect(lockManager.getLockedCount()).toBe(0);

      lockManager.lockRecords(['id1', 'id2', 'id3']);
      expect(lockManager.getLockedCount()).toBe(3);

      lockManager.unlockRecords(['id1']);
      expect(lockManager.getLockedCount()).toBe(2);
    });
  });

  describe('bufferUpdate / flushBuffer', () => {
    it('should buffer updates for locked records', () => {
      lockManager.lockRecords(['id1']);

      lockManager.bufferUpdate('id1', 'transactions', { name: 'test' });

      expect(lockManager.hasBufferedUpdates()).toBe(true);
      expect(lockManager.hasBufferedUpdate('id1')).toBe(true);
      expect(lockManager.getBufferedCount()).toBe(1);
    });

    it('should flush and clear buffer', () => {
      lockManager.lockRecords(['id1']);
      lockManager.bufferUpdate('id1', 'transactions', { name: 'test' });

      const flushed = lockManager.flushBuffer();

      expect(flushed).toHaveLength(1);
      expect(flushed[0].id).toBe('id1');
      expect(flushed[0].tableName).toBe('transactions');
      expect(flushed[0].updateData).toEqual({ name: 'test' });

      // Buffer should be cleared
      expect(lockManager.hasBufferedUpdates()).toBe(false);
      expect(lockManager.getBufferedCount()).toBe(0);
    });

    it('should keep only latest update for same record (last-write-wins)', () => {
      lockManager.lockRecords(['id1']);

      lockManager.bufferUpdate('id1', 'transactions', { name: 'first' });
      lockManager.bufferUpdate('id1', 'transactions', { name: 'second' });
      lockManager.bufferUpdate('id1', 'transactions', { name: 'third' });

      const flushed = lockManager.flushBuffer();

      expect(flushed).toHaveLength(1);
      expect(flushed[0].updateData).toEqual({ name: 'third' });
    });
  });

  describe('checkAndBufferIfLocked helper', () => {
    it('should return isLocked: false for unlocked records', () => {
      const result = checkAndBufferIfLocked('id1', 'transactions', { name: 'test' });

      expect(result.isLocked).toBe(false);
      expect(lockManager.hasBufferedUpdate('id1')).toBe(false);
    });

    it('should buffer and return isLocked: true for locked records', () => {
      lockManager.lockRecords(['id1']);

      const result = checkAndBufferIfLocked('id1', 'transactions', { name: 'test' });

      expect(result.isLocked).toBe(true);
      expect(lockManager.hasBufferedUpdate('id1')).toBe(true);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getSyncLockManager();
      const instance2 = getSyncLockManager();

      expect(instance1).toBe(instance2);
    });

    it('should share state across calls', () => {
      const instance1 = getSyncLockManager();
      instance1.lockRecords(['id1']);

      const instance2 = getSyncLockManager();
      expect(instance2.isLocked('id1')).toBe(true);
    });

    it('should reset singleton correctly', () => {
      const instance1 = getSyncLockManager();
      instance1.lockRecords(['id1']);

      resetSyncLockManager();

      const instance2 = getSyncLockManager();
      expect(instance2.isLocked('id1')).toBe(false);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('clearAllLocks / reset', () => {
    it('should clear all locks but preserve buffer', () => {
      lockManager.lockRecords(['id1', 'id2']);
      lockManager.bufferUpdate('id1', 'transactions', { name: 'test' });

      lockManager.clearAllLocks();

      expect(lockManager.isLocked('id1')).toBe(false);
      expect(lockManager.isLocked('id2')).toBe(false);
      expect(lockManager.hasBufferedUpdates()).toBe(true); // Buffer preserved
    });

    it('should reset both locks and buffer', () => {
      lockManager.lockRecords(['id1', 'id2']);
      lockManager.bufferUpdate('id1', 'transactions', { name: 'test' });

      lockManager.reset();

      expect(lockManager.isLocked('id1')).toBe(false);
      expect(lockManager.hasBufferedUpdates()).toBe(false);
    });
  });
});
