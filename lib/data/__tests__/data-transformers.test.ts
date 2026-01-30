import { describe, it, expect } from 'vitest';
import {
  dbMonthlySpendingToDomain,
  isValidMonthKey,
  type MonthlySpendingDbRow,
  type CategoryLookupEntry,
} from '../data-transformers';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const UUID_PARENT = '550e8400-e29b-41d4-a716-446655440001';
const UUID_CHILD = '550e8400-e29b-41d4-a716-446655440002';

// ============================================================================
// isValidMonthKey TESTS
// ============================================================================

describe('isValidMonthKey', () => {
  it('accepts valid YYYY-MM format', () => {
    expect(isValidMonthKey('2026-01')).toBe(true);
    expect(isValidMonthKey('2026-12')).toBe(true);
    expect(isValidMonthKey('1999-06')).toBe(true);
  });

  it('rejects single digit month', () => {
    expect(isValidMonthKey('2026-1')).toBe(false);
    expect(isValidMonthKey('2026-9')).toBe(false);
  });

  it('rejects month > 12', () => {
    expect(isValidMonthKey('2026-13')).toBe(false);
    expect(isValidMonthKey('2026-00')).toBe(false);
  });

  it('rejects wrong format', () => {
    expect(isValidMonthKey('Jan-2026')).toBe(false);
    expect(isValidMonthKey('2026/01')).toBe(false);
    expect(isValidMonthKey('01-2026')).toBe(false);
    expect(isValidMonthKey('202601')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidMonthKey(null)).toBe(false);
    expect(isValidMonthKey(undefined)).toBe(false);
    expect(isValidMonthKey(202601)).toBe(false);
    expect(isValidMonthKey({ month: '2026-01' })).toBe(false);
  });
});

// ============================================================================
// dbMonthlySpendingToDomain TESTS
// ============================================================================

describe('dbMonthlySpendingToDomain', () => {
  const baseLookup = new Map<string, CategoryLookupEntry>([
    [UUID, { type: 'expense', parent_id: null, name: 'Food', color: '#10B981' }],
  ]);

  describe('basic transformation', () => {
    it('transforms snake_case to camelCase', () => {
      const rows: MonthlySpendingDbRow[] = [{
        category_id: UUID,
        category_name: 'Food',
        category_color: '#10B981',
        month_key: '2026-01',
        total_amount: 5000,
      }];

      const result = dbMonthlySpendingToDomain(rows, baseLookup);

      expect(result).toHaveLength(1);
      expect(result[0].categoryId).toBe(UUID);
      expect(result[0].categoryName).toBe('Food');
      expect(result[0].categoryColor).toBe('#10B981');
      expect(result[0].categoryType).toBe('expense');
      expect(result[0].parentId).toBeNull();
      expect(result[0].isVirtualParent).toBe(false);
    });

    it('aggregates monthly amounts correctly', () => {
      const rows: MonthlySpendingDbRow[] = [
        { category_id: UUID, category_name: 'Food', category_color: '#10B981', month_key: '2026-01', total_amount: 5000 },
        { category_id: UUID, category_name: 'Food', category_color: '#10B981', month_key: '2026-02', total_amount: 7500 },
      ];

      const result = dbMonthlySpendingToDomain(rows, baseLookup);

      expect(result[0].monthlyAmounts).toEqual({
        '2026-01': 5000,
        '2026-02': 7500,
      });
    });
  });

  describe('data sanitization', () => {
    it('sanitizes string total_amount to number', () => {
      const rows: MonthlySpendingDbRow[] = [{
        category_id: UUID,
        category_name: 'Food',
        category_color: '#10B981',
        month_key: '2026-01',
        total_amount: '5000' as any,  // RPC may return string from JSONB
      }];

      const result = dbMonthlySpendingToDomain(rows, baseLookup);

      expect(result[0].monthlyAmounts['2026-01']).toBe(5000);
      expect(typeof result[0].monthlyAmounts['2026-01']).toBe('number');
    });

    it('handles NaN total_amount by defaulting to 0', () => {
      const rows: MonthlySpendingDbRow[] = [{
        category_id: UUID,
        category_name: 'Food',
        category_color: '#10B981',
        month_key: '2026-01',
        total_amount: 'invalid' as any,
      }];

      const result = dbMonthlySpendingToDomain(rows, baseLookup);

      expect(result[0].monthlyAmounts['2026-01']).toBe(0);
    });

    it('skips invalid month_key formats', () => {
      const rows: MonthlySpendingDbRow[] = [
        { category_id: UUID, category_name: 'Food', category_color: '#10B981', month_key: 'invalid', total_amount: 5000 },
        { category_id: UUID, category_name: 'Food', category_color: '#10B981', month_key: '2026-01', total_amount: 3000 },
      ];

      const result = dbMonthlySpendingToDomain(rows, baseLookup);

      // Only valid month_key should be present
      expect(result[0].monthlyAmounts).toEqual({ '2026-01': 3000 });
      expect(result[0].monthlyAmounts['invalid']).toBeUndefined();
    });
  });

  describe('empty data handling', () => {
    it('returns empty array for empty input', () => {
      expect(dbMonthlySpendingToDomain([], baseLookup)).toEqual([]);
    });

    it('returns empty array for null-ish input', () => {
      expect(dbMonthlySpendingToDomain(null as any, baseLookup)).toEqual([]);
      expect(dbMonthlySpendingToDomain(undefined as any, baseLookup)).toEqual([]);
    });
  });

  describe('parent category injection', () => {
    it('injects parent from lookup when child has spending', () => {
      const lookupWithParent = new Map<string, CategoryLookupEntry>([
        [UUID_PARENT, { type: 'expense', parent_id: null, name: 'Groceries', color: '#3B82F6' }],
        [UUID_CHILD, { type: 'expense', parent_id: UUID_PARENT, name: 'Vegetables', color: '#10B981' }],
      ]);

      // Only child has spending data
      const rows: MonthlySpendingDbRow[] = [{
        category_id: UUID_CHILD,
        category_name: 'Vegetables',
        category_color: '#10B981',
        month_key: '2026-01',
        total_amount: 2500,
      }];

      const result = dbMonthlySpendingToDomain(rows, lookupWithParent);

      // Should have both child and parent
      expect(result).toHaveLength(2);

      const child = result.find(c => c.categoryId === UUID_CHILD);
      const parent = result.find(c => c.categoryId === UUID_PARENT);

      expect(child).toBeDefined();
      expect(child?.parentId).toBe(UUID_PARENT);

      expect(parent).toBeDefined();
      expect(parent?.categoryName).toBe('Groceries');
      expect(parent?.monthlyAmounts).toEqual({}); // Parent has no spending
      expect(parent?.isVirtualParent).toBe(false);
    });
  });

  describe('Virtual Parent injection (orphaned categories)', () => {
    it('injects Virtual Parent when parent not in lookup', () => {
      // Lookup only has child, parent is missing (orphaned)
      const lookupWithOrphanedChild = new Map<string, CategoryLookupEntry>([
        [UUID_CHILD, { type: 'expense', parent_id: UUID_PARENT, name: 'Groceries', color: '#10B981' }],
        // UUID_PARENT NOT in lookup
      ]);

      const rows: MonthlySpendingDbRow[] = [{
        category_id: UUID_CHILD,
        category_name: 'Groceries',
        category_color: '#10B981',
        month_key: '2026-01',
        total_amount: 5000,
      }];

      const result = dbMonthlySpendingToDomain(rows, lookupWithOrphanedChild);

      const virtualParent = result.find(c => c.categoryId === UUID_PARENT);

      expect(virtualParent).toBeDefined();
      expect(virtualParent?.isVirtualParent).toBe(true);
      expect(virtualParent?.categoryName).toBe('[Uncategorized]');
      expect(virtualParent?.categoryColor).toBe('#6B7280'); // gray-500
      expect(virtualParent?.categoryType).toBe('expense'); // Inherited from child
      expect(virtualParent?.parentId).toBeNull(); // Virtual parents are top-level
      expect(virtualParent?.monthlyAmounts).toEqual({});
    });

    it('inherits categoryType from child for Virtual Parent', () => {
      const lookupWithIncomeOrphan = new Map<string, CategoryLookupEntry>([
        [UUID_CHILD, { type: 'income', parent_id: UUID_PARENT, name: 'Salary', color: '#22C55E' }],
      ]);

      const rows: MonthlySpendingDbRow[] = [{
        category_id: UUID_CHILD,
        category_name: 'Salary',
        category_color: '#22C55E',
        month_key: '2026-01',
        total_amount: 500000,
      }];

      const result = dbMonthlySpendingToDomain(rows, lookupWithIncomeOrphan);
      const virtualParent = result.find(c => c.categoryId === UUID_PARENT);

      expect(virtualParent?.categoryType).toBe('income');
    });
  });

  describe('negative amounts (refunds)', () => {
    it('handles negative amounts correctly', () => {
      const rows: MonthlySpendingDbRow[] = [{
        category_id: UUID,
        category_name: 'Returns',
        category_color: '#EF4444',
        month_key: '2026-01',
        total_amount: -2500,
      }];

      const result = dbMonthlySpendingToDomain(rows, baseLookup);

      expect(result[0].monthlyAmounts['2026-01']).toBe(-2500);
    });
  });

  describe('category type fallback', () => {
    it('defaults to expense when category not in lookup', () => {
      const emptyLookup = new Map<string, CategoryLookupEntry>();

      const rows: MonthlySpendingDbRow[] = [{
        category_id: UUID,
        category_name: 'Unknown',
        category_color: '#999999',
        month_key: '2026-01',
        total_amount: 1000,
      }];

      const result = dbMonthlySpendingToDomain(rows, emptyLookup);

      expect(result[0].categoryType).toBe('expense');
    });
  });
});
