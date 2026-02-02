/**
 * InboxService Unit Tests
 *
 * Tests the service layer responsibilities:
 * 1. Auth flow handling (getUserId extraction via IAuthProvider)
 * 2. Error propagation from auth to caller
 * 3. Delegation to repository methods
 * 4. All methods return DataResult<T>
 *
 * Pattern: Pure constructor injection — no vi.mock(), no singleton, no module patching.
 *
 * @module inbox-service-test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IInboxRepository } from '../../repository/inbox-repository.interface';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { InboxItemViewEntity } from '@/domain/inbox';
import { InboxRepositoryError, VersionConflictError } from '../../domain/errors';
import { InboxService } from '../inbox-service';

// ---------------------------------------------------------------------------
// Mock Dependencies (injected via constructor — no vi.mock needed)
// ---------------------------------------------------------------------------

const mockAuthProvider: IAuthProvider = {
  getCurrentUserId: vi.fn(),
  isAuthenticated: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  updateUserMetadata: vi.fn(),
  onAuthStateChange: vi.fn(() => vi.fn()),
};

const mockRepository = {
  getPendingPaginated: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  createBatch: vi.fn(),
  updateBatch: vi.fn(),
  promote: vi.fn(),
  dismiss: vi.fn(),
} as unknown as IInboxRepository;

// ---------------------------------------------------------------------------
// Test Fixtures (aligned with TransactionInboxViewRowSchema — all 19 fields)
// ---------------------------------------------------------------------------

const testUserId = 'user-123';

const testInboxItem: InboxItemViewEntity = {
  id: 'inbox-1',
  userId: testUserId,
  amountCents: 1050,
  currencyCode: 'USD',
  description: 'Coffee',
  date: '2024-01-15T10:30:00.000Z',
  sourceText: null,
  accountId: 'acc-1',
  categoryId: 'cat-1',
  exchangeRate: null,
  notes: null,
  status: 'pending',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
  version: 1,
  deletedAt: null,
  // CLEAN-02: Removed ghost props `account` and `category`
};

describe('InboxService', () => {
  let service: InboxService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InboxService(mockRepository, mockAuthProvider);
  });

  // ==========================================================================
  // AUTH FLOW TESTS
  // ==========================================================================

  describe('Authentication Flow', () => {
    it('should return error when user is not authenticated', async () => {
      (mockAuthProvider.getCurrentUserId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getPendingPaginated();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InboxRepositoryError);
        expect(result.error.message).toBe('Not authenticated');
      }
      expect(mockRepository.getPendingPaginated).not.toHaveBeenCalled();
    });

    it('should return error when auth throws an exception', async () => {
      (mockAuthProvider.getCurrentUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.getById('inbox-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InboxRepositoryError);
        expect(result.error.message).toBe('Network error');
      }
    });

    it('should return error when auth provider returns empty string', async () => {
      (mockAuthProvider.getCurrentUserId as ReturnType<typeof vi.fn>).mockResolvedValue('');

      const result = await service.create({ amountCents: 1000 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Not authenticated');
      }
    });

    it('should extract userId and call repository when authenticated', async () => {
      (mockAuthProvider.getCurrentUserId as ReturnType<typeof vi.fn>).mockResolvedValue(testUserId);
      (mockRepository.getPendingPaginated as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { data: [], total: 0, offset: 0, limit: 20, hasMore: false },
      });

      const result = await service.getPendingPaginated({ offset: 0, limit: 10 });

      expect(result.success).toBe(true);
      expect(mockRepository.getPendingPaginated).toHaveBeenCalledWith(
        testUserId,
        { offset: 0, limit: 10 }
      );
    });
  });

  // ==========================================================================
  // DELEGATION TESTS
  // ==========================================================================

  describe('Repository Delegation', () => {
    beforeEach(() => {
      (mockAuthProvider.getCurrentUserId as ReturnType<typeof vi.fn>).mockResolvedValue(testUserId);
    });

    describe('getPendingPaginated', () => {
      it('should delegate to repository with userId and pagination', async () => {
        const paginatedResult = {
          data: [testInboxItem],
          total: 1,
          offset: 0,
          limit: 20,
          hasMore: false,
        };
        (mockRepository.getPendingPaginated as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          data: paginatedResult,
        });

        const result = await service.getPendingPaginated({ offset: 10, limit: 5 });

        expect(mockRepository.getPendingPaginated).toHaveBeenCalledWith(
          testUserId,
          { offset: 10, limit: 5 }
        );
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(paginatedResult);
        }
      });
    });

    describe('getById', () => {
      it('should delegate to repository with userId and id', async () => {
        (mockRepository.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          data: testInboxItem,
        });

        const result = await service.getById('inbox-1');

        expect(mockRepository.getById).toHaveBeenCalledWith(testUserId, 'inbox-1');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(testInboxItem);
        }
      });
    });

    describe('create', () => {
      it('should delegate to repository with userId and data', async () => {
        const createData = { amountCents: 1050, description: 'Test' };
        (mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          data: testInboxItem,
        });

        const result = await service.create(createData);

        expect(mockRepository.create).toHaveBeenCalledWith(testUserId, createData);
        expect(result.success).toBe(true);
      });
    });

    describe('update', () => {
      it('should delegate to repository with userId, id, and data', async () => {
        const updateData = { description: 'Updated', lastKnownVersion: 1 };
        (mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          data: { ...testInboxItem, description: 'Updated', version: 2 },
        });

        const result = await service.update('inbox-1', updateData);

        expect(mockRepository.update).toHaveBeenCalledWith(testUserId, 'inbox-1', updateData);
        expect(result.success).toBe(true);
      });
    });

    describe('createBatch', () => {
      it('should delegate to repository with userId and items array', async () => {
        const items = [
          { amountCents: 1050, description: 'Coffee' },
          { amountCents: 2500, description: 'Lunch' },
        ];
        (mockRepository.createBatch as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          data: [testInboxItem, { ...testInboxItem, id: 'inbox-2' }],
        });

        const result = await service.createBatch(items);

        expect(mockRepository.createBatch).toHaveBeenCalledWith(testUserId, items);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(2);
        }
      });
    });

    describe('updateBatch', () => {
      it('should delegate to repository with userId and updates array', async () => {
        const updates = [
          { id: 'inbox-1', data: { categoryId: 'cat-2' } },
          { id: 'inbox-2', data: { accountId: 'acc-2' } },
        ];
        (mockRepository.updateBatch as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          data: [testInboxItem, { ...testInboxItem, id: 'inbox-2' }],
        });

        const result = await service.updateBatch(updates);

        expect(mockRepository.updateBatch).toHaveBeenCalledWith(testUserId, updates);
        expect(result.success).toBe(true);
      });
    });

    describe('promote', () => {
      it('should delegate to repository with userId and promotion data', async () => {
        const promoteData = {
          inboxId: 'inbox-1',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          finalAmountCents: 1050,
          finalDate: '2024-01-15T10:30:00.000Z',
        };
        (mockRepository.promote as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          data: { transactionId: 'txn-1', inboxId: 'inbox-1' },
        });

        const result = await service.promote(promoteData);

        expect(mockRepository.promote).toHaveBeenCalledWith(testUserId, promoteData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.transactionId).toBe('txn-1');
        }
      });
    });

    describe('dismiss', () => {
      it('should delegate to repository with userId and id', async () => {
        (mockRepository.dismiss as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          data: undefined,
        });

        const result = await service.dismiss('inbox-1');

        expect(mockRepository.dismiss).toHaveBeenCalledWith(testUserId, 'inbox-1');
        expect(result.success).toBe(true);
      });
    });
  });

  // ==========================================================================
  // ERROR PROPAGATION TESTS
  // ==========================================================================

  describe('Error Propagation', () => {
    beforeEach(() => {
      (mockAuthProvider.getCurrentUserId as ReturnType<typeof vi.fn>).mockResolvedValue(testUserId);
    });

    it('should propagate repository errors unchanged', async () => {
      const repoError = new InboxRepositoryError('Database connection failed');
      (mockRepository.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        data: null,
        error: repoError,
      });

      const result = await service.getById('inbox-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(repoError);
        expect(result.error.message).toBe('Database connection failed');
      }
    });

    it('should propagate VersionConflictError from update', async () => {
      const versionError = new VersionConflictError('inbox-1', 1, 2);
      (mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        data: null,
        error: versionError,
      });

      const result = await service.update('inbox-1', {
        description: 'Test',
        lastKnownVersion: 1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(VersionConflictError);
      }
    });

    it('should propagate errors from batch operations', async () => {
      const batchError = new InboxRepositoryError('Batch create failed at item 2');
      (mockRepository.createBatch as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        data: null,
        error: batchError,
      });

      const result = await service.createBatch([
        { amountCents: 1000 },
        { amountCents: 2000 },
      ]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Batch create failed');
      }
    });
  });

  // ==========================================================================
  // DATA TRANSFORMATION TESTS
  // ==========================================================================

  describe('PromoteInboxItemDTO Transformation', () => {
    beforeEach(() => {
      (mockAuthProvider.getCurrentUserId as ReturnType<typeof vi.fn>).mockResolvedValue(testUserId);
    });

    it('should pass finalAmountCents (integer cents) to repository', async () => {
      (mockRepository.promote as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { transactionId: 'txn-1', inboxId: 'inbox-1' },
      });

      await service.promote({
        inboxId: 'inbox-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        finalAmountCents: 1050,
        lastKnownVersion: 1,
      });

      const call = (mockRepository.promote as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].finalAmountCents).toBe(1050);
      expect(Number.isInteger(call[1].finalAmountCents)).toBe(true);
    });

    it('should pass ISO 8601 date format to repository', async () => {
      (mockRepository.promote as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { transactionId: 'txn-1', inboxId: 'inbox-1' },
      });

      const isoDate = '2024-01-15T10:30:00.000Z';
      await service.promote({
        inboxId: 'inbox-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        finalDate: isoDate,
      });

      const call = (mockRepository.promote as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].finalDate).toBe(isoDate);
      expect(call[1].finalDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
