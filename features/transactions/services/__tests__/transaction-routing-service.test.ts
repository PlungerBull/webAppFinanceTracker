/**
 * Unit Tests for TransactionRoutingService
 *
 * CTO MANDATE: Test all 16 permutations of the 4 required fields.
 *
 * Tests cover:
 * - determineRoute() pure function (16 permutation matrix)
 * - Sacred Rule: amountCents: 0 treated as MISSING
 * - missingFields precision (exact keys for UI highlighting)
 * - submitTransaction() delegation to services
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionRoutingService } from '../transaction-routing-service';
import type { ITransactionService } from '../transaction-service.interface';
import type { IInboxOperations } from '@/domain/inbox';
import type { TransactionRouteInputDTO, TransactionRequiredField } from '../../domain/types';
import type { TransactionViewEntity } from '../../domain/entities';

// Mock TransactionService
const mockTransactionService: ITransactionService = {
  getAllPaginated: vi.fn(),
  getById: vi.fn(),
  getCategoryCounts: vi.fn(),
  getCountByCategory: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateBatch: vi.fn(),
  bulkUpdate: vi.fn(),
  delete: vi.fn(),
  restore: vi.fn(),
  getDeleted: vi.fn(),
  getChangesSince: vi.fn(),
};

// Mock InboxOperations (using domain interface for loose coupling)
const mockInboxService: IInboxOperations = {
  create: vi.fn(),
  update: vi.fn(),
  promote: vi.fn(),
};

// Helper to create input DTO with defaults
function createInput(
  overrides: Partial<TransactionRouteInputDTO> = {}
): TransactionRouteInputDTO {
  return {
    amountCents: null,
    description: null,
    accountId: null,
    categoryId: null,
    date: '2024-01-12T10:00:00.000Z',
    ...overrides,
  };
}

// Mock transaction result for service create
function createMockTransaction(id: string): TransactionViewEntity {
  return {
    id,
    version: 1,
    userId: 'user-1',
    amountCents: 1050,
    amountHomeCents: 1050,
    currencyOriginal: 'USD',
    exchangeRate: 1,
    accountId: 'acc-123',
    categoryId: 'cat-456',
    transferId: null,
    description: 'Coffee',
    notes: null,
    date: '2024-01-12T10:00:00.000Z',
    createdAt: '2024-01-12T10:00:00.000Z',
    updatedAt: '2024-01-12T10:00:00.000Z',
    deletedAt: null,
    reconciliationId: null,
    cleared: false,
    accountName: 'Test Account',
    // REMOVED: accountCurrency (Ghost Prop - use currencyOriginal instead)
    accountColor: '#3b82f6',
    categoryName: 'Food',
    categoryColor: '#ef4444',
    categoryType: 'expense',
    reconciliationStatus: null,
  };
}

describe('TransactionRoutingService', () => {
  let service: TransactionRoutingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TransactionRoutingService(mockTransactionService, mockInboxService);
  });

  // ============================================================================
  // DETERMINE ROUTE - PURE FUNCTION TESTS
  // ============================================================================

  describe('determineRoute (pure function)', () => {
    describe('Sacred Rule: amountCents edge cases', () => {
      it('treats amountCents: 0 as MISSING (prevents balance bugs)', () => {
        const result = service.determineRoute(
          createInput({
            amountCents: 0, // SACRED RULE: 0 is MISSING
            description: 'Coffee',
            accountId: 'acc-123',
            categoryId: 'cat-456',
          })
        );

        expect(result.route).toBe('inbox');
        expect(result.isComplete).toBe(false);
        expect(result.missingFields).toContain('amountCents');
      });

      it('treats amountCents: null as MISSING', () => {
        const result = service.determineRoute(
          createInput({
            amountCents: null,
            description: 'Coffee',
            accountId: 'acc-123',
            categoryId: 'cat-456',
          })
        );

        expect(result.route).toBe('inbox');
        expect(result.isComplete).toBe(false);
        expect(result.missingFields).toContain('amountCents');
      });

      it('treats amountCents: -100 as VALID (expense)', () => {
        const result = service.determineRoute(
          createInput({
            amountCents: -100, // Negative = expense
            description: 'Coffee',
            accountId: 'acc-123',
            categoryId: 'cat-456',
          })
        );

        expect(result.route).toBe('ledger');
        expect(result.isComplete).toBe(true);
        expect(result.missingFields).not.toContain('amountCents');
      });

      it('treats amountCents: 100 as VALID (income)', () => {
        const result = service.determineRoute(
          createInput({
            amountCents: 100, // Positive = income
            description: 'Salary',
            accountId: 'acc-123',
            categoryId: 'cat-456',
          })
        );

        expect(result.route).toBe('ledger');
        expect(result.isComplete).toBe(true);
        expect(result.missingFields).not.toContain('amountCents');
      });
    });

    describe('description edge cases', () => {
      it('treats empty string description as MISSING', () => {
        const result = service.determineRoute(
          createInput({
            amountCents: 100,
            description: '',
            accountId: 'acc-123',
            categoryId: 'cat-456',
          })
        );

        expect(result.route).toBe('inbox');
        expect(result.missingFields).toContain('description');
      });

      it('treats whitespace-only description as MISSING', () => {
        const result = service.determineRoute(
          createInput({
            amountCents: 100,
            description: '   ',
            accountId: 'acc-123',
            categoryId: 'cat-456',
          })
        );

        expect(result.route).toBe('inbox');
        expect(result.missingFields).toContain('description');
      });

      it('treats valid description as PRESENT', () => {
        const result = service.determineRoute(
          createInput({
            amountCents: 100,
            description: 'Coffee',
            accountId: 'acc-123',
            categoryId: 'cat-456',
          })
        );

        expect(result.route).toBe('ledger');
        expect(result.missingFields).not.toContain('description');
      });
    });

    describe('missingFields precision', () => {
      it('returns ["amountCents"] when only amount missing', () => {
        const result = service.determineRoute(
          createInput({
            amountCents: null,
            description: 'Coffee',
            accountId: 'acc-123',
            categoryId: 'cat-456',
          })
        );

        expect(result.missingFields).toEqual(['amountCents']);
      });

      it('returns ["categoryId", "description"] when both missing (order by check order)', () => {
        const result = service.determineRoute(
          createInput({
            amountCents: 100,
            description: null,
            accountId: 'acc-123',
            categoryId: null,
          })
        );

        // Order depends on check order in implementation
        expect(result.missingFields).toContain('description');
        expect(result.missingFields).toContain('categoryId');
        expect(result.missingFields).toHaveLength(2);
      });

      it('returns [] when all fields complete', () => {
        const result = service.determineRoute(
          createInput({
            amountCents: 100,
            description: 'Coffee',
            accountId: 'acc-123',
            categoryId: 'cat-456',
          })
        );

        expect(result.missingFields).toEqual([]);
      });

      it('returns all 4 missing fields when data is empty', () => {
        const result = service.determineRoute(createInput());

        expect(result.missingFields).toContain('amountCents');
        expect(result.missingFields).toContain('description');
        expect(result.missingFields).toContain('accountId');
        expect(result.missingFields).toContain('categoryId');
        expect(result.missingFields).toHaveLength(4);
      });
    });

    describe('hasAnyData calculation', () => {
      it('returns false when all fields are null/empty', () => {
        const result = service.determineRoute(createInput());

        expect(result.hasAnyData).toBe(false);
      });

      it('returns true when only amount is present', () => {
        const result = service.determineRoute(createInput({ amountCents: 100 }));

        expect(result.hasAnyData).toBe(true);
      });

      it('returns true when only description is present', () => {
        const result = service.determineRoute(createInput({ description: 'Coffee' }));

        expect(result.hasAnyData).toBe(true);
      });

      it('returns true when only account is present', () => {
        const result = service.determineRoute(createInput({ accountId: 'acc-123' }));

        expect(result.hasAnyData).toBe(true);
      });

      it('returns true when only category is present', () => {
        const result = service.determineRoute(createInput({ categoryId: 'cat-456' }));

        expect(result.hasAnyData).toBe(true);
      });
    });

    describe('routing decision: 16 permutation matrix', () => {
      // All 16 permutations of 4 required fields (2^4 = 16)
      // Only ONE combination routes to ledger (all 4 present)
      const permutations: Array<{
        amount: number | null;
        desc: string | null;
        acc: string | null;
        cat: string | null;
        expectedRoute: 'ledger' | 'inbox';
        expectedMissing: TransactionRequiredField[];
      }> = [
        // 0000 - all missing
        { amount: null, desc: null, acc: null, cat: null, expectedRoute: 'inbox', expectedMissing: ['amountCents', 'description', 'accountId', 'categoryId'] },
        // 0001 - only category
        { amount: null, desc: null, acc: null, cat: 'cat', expectedRoute: 'inbox', expectedMissing: ['amountCents', 'description', 'accountId'] },
        // 0010 - only account
        { amount: null, desc: null, acc: 'acc', cat: null, expectedRoute: 'inbox', expectedMissing: ['amountCents', 'description', 'categoryId'] },
        // 0011 - account + category
        { amount: null, desc: null, acc: 'acc', cat: 'cat', expectedRoute: 'inbox', expectedMissing: ['amountCents', 'description'] },
        // 0100 - only description
        { amount: null, desc: 'Coffee', acc: null, cat: null, expectedRoute: 'inbox', expectedMissing: ['amountCents', 'accountId', 'categoryId'] },
        // 0101 - description + category
        { amount: null, desc: 'Coffee', acc: null, cat: 'cat', expectedRoute: 'inbox', expectedMissing: ['amountCents', 'accountId'] },
        // 0110 - description + account
        { amount: null, desc: 'Coffee', acc: 'acc', cat: null, expectedRoute: 'inbox', expectedMissing: ['amountCents', 'categoryId'] },
        // 0111 - description + account + category
        { amount: null, desc: 'Coffee', acc: 'acc', cat: 'cat', expectedRoute: 'inbox', expectedMissing: ['amountCents'] },
        // 1000 - only amount
        { amount: 100, desc: null, acc: null, cat: null, expectedRoute: 'inbox', expectedMissing: ['description', 'accountId', 'categoryId'] },
        // 1001 - amount + category
        { amount: 100, desc: null, acc: null, cat: 'cat', expectedRoute: 'inbox', expectedMissing: ['description', 'accountId'] },
        // 1010 - amount + account
        { amount: 100, desc: null, acc: 'acc', cat: null, expectedRoute: 'inbox', expectedMissing: ['description', 'categoryId'] },
        // 1011 - amount + account + category
        { amount: 100, desc: null, acc: 'acc', cat: 'cat', expectedRoute: 'inbox', expectedMissing: ['description'] },
        // 1100 - amount + description
        { amount: 100, desc: 'Coffee', acc: null, cat: null, expectedRoute: 'inbox', expectedMissing: ['accountId', 'categoryId'] },
        // 1101 - amount + description + category
        { amount: 100, desc: 'Coffee', acc: null, cat: 'cat', expectedRoute: 'inbox', expectedMissing: ['accountId'] },
        // 1110 - amount + description + account
        { amount: 100, desc: 'Coffee', acc: 'acc', cat: null, expectedRoute: 'inbox', expectedMissing: ['categoryId'] },
        // 1111 - ALL PRESENT → ONLY THIS ONE ROUTES TO LEDGER!
        { amount: 100, desc: 'Coffee', acc: 'acc', cat: 'cat', expectedRoute: 'ledger', expectedMissing: [] },
      ];

      it.each(permutations)(
        'amount=$amount desc=$desc acc=$acc cat=$cat → $expectedRoute (missing: $expectedMissing)',
        ({ amount, desc, acc, cat, expectedRoute, expectedMissing }) => {
          const result = service.determineRoute(
            createInput({
              amountCents: amount,
              description: desc,
              accountId: acc,
              categoryId: cat,
            })
          );

          expect(result.route).toBe(expectedRoute);
          expect(result.isComplete).toBe(expectedRoute === 'ledger');
          expect(result.missingFields.sort()).toEqual([...expectedMissing].sort());
        }
      );
    });
  });

  // ============================================================================
  // SUBMIT TRANSACTION TESTS
  // ============================================================================

  describe('submitTransaction', () => {
    it('throws error when data has no fields', async () => {
      await expect(service.submitTransaction(createInput())).rejects.toThrow(
        'Cannot submit empty transaction data'
      );
    });

    it('routes to ledger and calls transactionService.create when complete', async () => {
      const mockTransaction = createMockTransaction('txn-123');
      vi.mocked(mockTransactionService.create).mockResolvedValue(mockTransaction);

      const result = await service.submitTransaction(
        createInput({
          amountCents: 1050,
          description: 'Coffee',
          accountId: 'acc-123',
          categoryId: 'cat-456',
          notes: 'Morning coffee',
        })
      );

      expect(result.route).toBe('ledger');
      expect(result.id).toBe('txn-123');
      expect(result.success).toBe(true);
      expect(result.entity).toBe(mockTransaction); // CTO MANDATE: Entity for optimistic UI

      expect(mockTransactionService.create).toHaveBeenCalledWith({
        accountId: 'acc-123',
        categoryId: 'cat-456',
        amountCents: 1050,
        description: 'Coffee',
        date: '2024-01-12T10:00:00.000Z',
        notes: 'Morning coffee',
      });
      expect(mockInboxService.create).not.toHaveBeenCalled();
    });

    it('routes to inbox and calls inboxService.create when partial', async () => {
      const mockInboxEntity = { id: 'inbox-456', userId: 'user-1', status: 'pending' };
      vi.mocked(mockInboxService.create).mockResolvedValue({
        success: true,
        data: mockInboxEntity,
      } as Awaited<ReturnType<typeof mockInboxService.create>>);

      const result = await service.submitTransaction(
        createInput({
          amountCents: 1050,
          description: 'Coffee',
          accountId: null, // Missing!
          categoryId: null, // Missing!
        })
      );

      expect(result.route).toBe('inbox');
      expect(result.id).toBe('inbox-456');
      expect(result.success).toBe(true);
      expect(result.entity).toBe(mockInboxEntity); // CTO MANDATE: Entity for optimistic UI

      expect(mockInboxService.create).toHaveBeenCalledWith({
        amountCents: 1050,
        description: 'Coffee',
        accountId: undefined,
        categoryId: undefined,
        date: '2024-01-12T10:00:00.000Z',
        notes: undefined,
      });
      expect(mockTransactionService.create).not.toHaveBeenCalled();
    });

    it('throws error when inbox creation fails', async () => {
      vi.mocked(mockInboxService.create).mockResolvedValue({
        success: false,
        data: null,
        error: { message: 'Database error' },
      } as Awaited<ReturnType<typeof mockInboxService.create>>);

      await expect(
        service.submitTransaction(
          createInput({
            amountCents: 1050,
            // Missing description, account, category
          })
        )
      ).rejects.toThrow('Database error');
    });

    it('handles transaction service error', async () => {
      vi.mocked(mockTransactionService.create).mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        service.submitTransaction(
          createInput({
            amountCents: 1050,
            description: 'Coffee',
            accountId: 'acc-123',
            categoryId: 'cat-456',
          })
        )
      ).rejects.toThrow('Network error');
    });

    it('converts undefined notes to undefined (not null) for inbox', async () => {
      vi.mocked(mockInboxService.create).mockResolvedValue({
        success: true,
        data: { id: 'inbox-789' },
      } as Awaited<ReturnType<typeof mockInboxService.create>>);

      await service.submitTransaction(
        createInput({
          amountCents: 100,
          // notes is undefined
        })
      );

      expect(mockInboxService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: undefined,
        })
      );
    });

    it('preserves notes when provided', async () => {
      const mockTransaction = createMockTransaction('txn-999');
      vi.mocked(mockTransactionService.create).mockResolvedValue(mockTransaction);

      await service.submitTransaction(
        createInput({
          amountCents: 1050,
          description: 'Coffee',
          accountId: 'acc-123',
          categoryId: 'cat-456',
          notes: 'Important note',
        })
      );

      expect(mockTransactionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Important note',
        })
      );
    });
  });

  // ============================================================================
  // SANITIZATION TESTS (CTO Mandate: Service layer sanitizes, not components)
  // ============================================================================

  describe('sanitization', () => {
    it('trims leading/trailing whitespace from description', async () => {
      const mockTransaction = createMockTransaction('txn-sanitized');
      vi.mocked(mockTransactionService.create).mockResolvedValue(mockTransaction);

      await service.submitTransaction(
        createInput({
          amountCents: 1050,
          description: '  Coffee  ',
          accountId: 'acc-123',
          categoryId: 'cat-456',
        })
      );

      expect(mockTransactionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Coffee',
        })
      );
    });

    it('trims leading/trailing whitespace from notes', async () => {
      const mockTransaction = createMockTransaction('txn-notes-trim');
      vi.mocked(mockTransactionService.create).mockResolvedValue(mockTransaction);

      await service.submitTransaction(
        createInput({
          amountCents: 1050,
          description: 'Coffee',
          accountId: 'acc-123',
          categoryId: 'cat-456',
          notes: '  Morning coffee  ',
        })
      );

      expect(mockTransactionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Morning coffee',
        })
      );
    });

    it('converts whitespace-only description to null (routes to inbox)', async () => {
      vi.mocked(mockInboxService.create).mockResolvedValue({
        success: true,
        data: { id: 'inbox-whitespace' },
      } as Awaited<ReturnType<typeof mockInboxService.create>>);

      const result = await service.submitTransaction(
        createInput({
          amountCents: 1050,
          description: '   ', // Whitespace only
          accountId: 'acc-123',
          categoryId: 'cat-456',
        })
      );

      // Should route to inbox because sanitized description is null
      expect(result.route).toBe('inbox');
      expect(mockInboxService.create).toHaveBeenCalled();
      expect(mockTransactionService.create).not.toHaveBeenCalled();
    });

    it('converts whitespace-only notes to null', async () => {
      vi.mocked(mockInboxService.create).mockResolvedValue({
        success: true,
        data: { id: 'inbox-notes-null' },
      } as Awaited<ReturnType<typeof mockInboxService.create>>);

      await service.submitTransaction(
        createInput({
          amountCents: 1050,
          description: 'Coffee',
          accountId: null, // Missing to route to inbox
          categoryId: null,
          notes: '   ', // Whitespace only → should become undefined
        })
      );

      expect(mockInboxService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: undefined, // null converted to undefined for inbox
        })
      );
    });

    it('normalizes internal whitespace ("Coffee  Shop" → "Coffee Shop")', async () => {
      const mockTransaction = createMockTransaction('txn-normalize');
      vi.mocked(mockTransactionService.create).mockResolvedValue(mockTransaction);

      await service.submitTransaction(
        createInput({
          amountCents: 1050,
          description: 'Coffee  Shop   Downtown',
          accountId: 'acc-123',
          categoryId: 'cat-456',
        })
      );

      expect(mockTransactionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Coffee Shop Downtown',
        })
      );
    });

    it('normalizes internal whitespace in notes', async () => {
      const mockTransaction = createMockTransaction('txn-notes-normalize');
      vi.mocked(mockTransactionService.create).mockResolvedValue(mockTransaction);

      await service.submitTransaction(
        createInput({
          amountCents: 1050,
          description: 'Coffee',
          accountId: 'acc-123',
          categoryId: 'cat-456',
          notes: 'Multiple   spaces    here',
        })
      );

      expect(mockTransactionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Multiple spaces here',
        })
      );
    });

    it('applies sanitization before routing decision', async () => {
      // This test ensures that sanitization happens BEFORE routing
      // A description that's all whitespace should be treated as missing
      const decision = service.determineRoute(
        createInput({
          amountCents: 1050,
          description: 'Valid', // Valid description
          accountId: 'acc-123',
          categoryId: 'cat-456',
        })
      );

      expect(decision.route).toBe('ledger');

      // Note: determineRoute itself doesn't sanitize - it checks the value as-is
      // The sanitization happens in submitTransaction before determineRoute is called
      // This is tested by the "whitespace-only routes to inbox" test above
    });

    it('description: " " routes to inbox (not ledger)', async () => {
      vi.mocked(mockInboxService.create).mockResolvedValue({
        success: true,
        data: { id: 'inbox-space' },
      } as Awaited<ReturnType<typeof mockInboxService.create>>);

      const result = await service.submitTransaction(
        createInput({
          amountCents: 1050,
          description: ' ', // Single space
          accountId: 'acc-123',
          categoryId: 'cat-456',
        })
      );

      expect(result.route).toBe('inbox');
      expect(mockInboxService.create).toHaveBeenCalled();
    });
  });
});
