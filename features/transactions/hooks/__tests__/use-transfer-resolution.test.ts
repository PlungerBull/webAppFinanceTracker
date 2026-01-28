/**
 * Unit Tests for useTransferResolution Hook
 *
 * CTO MANDATE: Test the Pure Resolver before touching the UI.
 *
 * Tests cover:
 * - Currency auto-selection (single vs multi-currency)
 * - Account ID resolution from Group + Currency
 * - Ghost Account prevention (null when no match)
 * - Effect loop prevention (suggestions only when value differs)
 * - Computed flags (isSameCurrencyTransfer, isLoopTransfer)
 * - Edge cases (empty arrays, null inputs)
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useTransferResolution,
  type TransferResolutionInput,
} from '../use-transfer-resolution';
import type { GroupedAccount } from '@/lib/hooks/use-grouped-accounts';
import type { AccountViewEntity } from '@/features/accounts/hooks/use-accounts';

// Test fixtures
const createGroupedAccount = (
  groupId: string,
  name: string,
  balances: Array<{ accountId: string; currency: string; amountCents: number }>
): GroupedAccount => ({
  groupId,
  name,
  color: '#000000',
  type: 'checking',
  balances,
});

const createRawAccount = (
  id: string,
  groupId: string,
  currencyCode: string
): AccountViewEntity => ({
  id,
  groupId,
  currencyCode,
  currencySymbol: currencyCode === 'USD' ? '$' : 'S/',
  name: 'Test Account',
  color: '#000000',
  type: 'checking',
  currentBalanceCents: 10000,
  version: 1,
  isVisible: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  deletedAt: null,
  userId: 'user-1',
});

// Standard test data
const singleCurrencyGroup = createGroupedAccount('group-single', 'Chase Visa', [
  { accountId: 'acc-single-usd', currency: 'USD', amountCents: 10000 },
]);

const multiCurrencyGroup = createGroupedAccount('group-multi', 'BBVA', [
  { accountId: 'acc-multi-usd', currency: 'USD', amountCents: 5000 },
  { accountId: 'acc-multi-pen', currency: 'PEN', amountCents: 20000 },
]);

const groupedAccounts: GroupedAccount[] = [singleCurrencyGroup, multiCurrencyGroup];

const rawAccounts: AccountViewEntity[] = [
  createRawAccount('acc-single-usd', 'group-single', 'USD'),
  createRawAccount('acc-multi-usd', 'group-multi', 'USD'),
  createRawAccount('acc-multi-pen', 'group-multi', 'PEN'),
];

const emptyInput: TransferResolutionInput = {
  fromGroupId: null,
  toGroupId: null,
  fromCurrency: null,
  toCurrency: null,
  fromAccountId: null,
  toAccountId: null,
};

describe('useTransferResolution', () => {
  describe('empty/null inputs', () => {
    it('returns empty suggestions when all inputs are null', () => {
      const { result } = renderHook(() =>
        useTransferResolution(emptyInput, groupedAccounts, rawAccounts)
      );

      expect(result.current.suggestions).toEqual({});
      expect(result.current.fromAccountCurrencies).toEqual([]);
      expect(result.current.toAccountCurrencies).toEqual([]);
      expect(result.current.isSameCurrencyTransfer).toBe(true); // null === null
      expect(result.current.isLoopTransfer).toBe(false);
    });

    it('handles empty groupedAccounts array', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'non-existent',
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, [], rawAccounts)
      );

      expect(result.current.suggestions).toEqual({});
      expect(result.current.selectedFromGroup).toBeUndefined();
    });

    it('handles empty rawAccounts array', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        fromCurrency: 'USD',
        fromAccountId: 'stale-id', // Has stale ID that needs clearing
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, [])
      );

      // No raw account found, should suggest null (Ghost Account prevention)
      expect(result.current.suggestions).toEqual({ fromAccountId: null });
    });

    it('handles empty rawAccounts with null accountId (no suggestion needed)', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        fromCurrency: 'USD',
        // fromAccountId is already null, no suggestion needed
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, [])
      );

      // Already null, no suggestion needed
      expect(result.current.suggestions).toEqual({});
    });
  });

  describe('currency auto-selection', () => {
    it('suggests fromCurrency when single-currency account selected', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        // fromCurrency is null, should auto-select
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.suggestions).toEqual({ fromCurrency: 'USD' });
      expect(result.current.isFromAccountMultiCurrency).toBe(false);
    });

    it('suggests toCurrency when single-currency account selected', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        toGroupId: 'group-single',
        // toCurrency is null, should auto-select
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.suggestions).toEqual({ toCurrency: 'USD' });
      expect(result.current.isToAccountMultiCurrency).toBe(false);
    });

    it('does NOT suggest currency when multi-currency account selected', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-multi',
        // fromCurrency is null, but multi-currency → no auto-select
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.suggestions).toEqual({});
      expect(result.current.isFromAccountMultiCurrency).toBe(true);
      expect(result.current.fromAccountCurrencies).toEqual(['USD', 'PEN']);
    });

    it('does NOT suggest currency when already set', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        fromCurrency: 'USD', // Already set
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      // Should NOT include fromCurrency in suggestions (already set)
      // But SHOULD include fromAccountId resolution
      expect(result.current.suggestions).toEqual({ fromAccountId: 'acc-single-usd' });
    });
  });

  describe('account ID resolution', () => {
    it('suggests fromAccountId when groupId + currency match raw account', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        fromCurrency: 'USD',
        fromAccountId: null,
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.suggestions).toEqual({ fromAccountId: 'acc-single-usd' });
    });

    it('suggests toAccountId when groupId + currency match raw account', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        toGroupId: 'group-multi',
        toCurrency: 'PEN',
        toAccountId: null,
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.suggestions).toEqual({ toAccountId: 'acc-multi-pen' });
    });

    it('does NOT suggest accountId when already matches (effect loop prevention)', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        fromCurrency: 'USD',
        fromAccountId: 'acc-single-usd', // Already correct!
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      // No suggestions - account already matches
      expect(result.current.suggestions).toEqual({});
    });

    it('suggests null when currency has no matching account (Ghost Account prevention)', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single', // This group only has USD
        fromCurrency: 'EUR', // No EUR account exists!
        fromAccountId: 'some-stale-id', // Stale ID from previous selection
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      // Should explicitly set to null to prevent Ghost Account
      expect(result.current.suggestions).toEqual({ fromAccountId: null });
    });

    it('does NOT suggest null when accountId already null', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        fromCurrency: 'EUR', // No EUR account
        fromAccountId: null, // Already null
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      // No suggestion needed - already null
      expect(result.current.suggestions).toEqual({});
    });
  });

  describe('isSameCurrencyTransfer flag', () => {
    it('returns true when both currencies are the same', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromCurrency: 'USD',
        toCurrency: 'USD',
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.isSameCurrencyTransfer).toBe(true);
    });

    it('returns false when currencies differ', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromCurrency: 'USD',
        toCurrency: 'PEN',
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.isSameCurrencyTransfer).toBe(false);
    });

    it('returns true when both currencies are null', () => {
      const { result } = renderHook(() =>
        useTransferResolution(emptyInput, groupedAccounts, rawAccounts)
      );

      expect(result.current.isSameCurrencyTransfer).toBe(true);
    });
  });

  describe('isLoopTransfer flag', () => {
    it('returns true when same accountId AND same currency', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromAccountId: 'acc-single-usd',
        toAccountId: 'acc-single-usd',
        fromCurrency: 'USD',
        toCurrency: 'USD',
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.isLoopTransfer).toBe(true);
    });

    it('returns false when same accountId but different currency', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromAccountId: 'acc-multi-usd',
        toAccountId: 'acc-multi-usd',
        fromCurrency: 'USD',
        toCurrency: 'PEN', // Different currency
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.isLoopTransfer).toBe(false);
    });

    it('returns false when different accountIds', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromAccountId: 'acc-single-usd',
        toAccountId: 'acc-multi-usd',
        fromCurrency: 'USD',
        toCurrency: 'USD',
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.isLoopTransfer).toBe(false);
    });

    it('returns false when either accountId is null', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromAccountId: 'acc-single-usd',
        toAccountId: null,
        fromCurrency: 'USD',
        toCurrency: 'USD',
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.isLoopTransfer).toBe(false);
    });
  });

  describe('selectedFromGroup and selectedToGroup', () => {
    it('returns undefined when groupId not found', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'non-existent',
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.selectedFromGroup).toBeUndefined();
    });

    it('returns correct group when groupId matches', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-multi',
        toGroupId: 'group-single',
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );

      expect(result.current.selectedFromGroup?.name).toBe('BBVA');
      expect(result.current.selectedToGroup?.name).toBe('Chase Visa');
    });
  });

  describe('16-permutation matrix (fromGroupId × fromCurrency)', () => {
    // Test all combinations: groupId (null, single, multi, invalid) × currency (null, valid, invalid)

    it('null groupId, null currency → no suggestions', () => {
      const input: TransferResolutionInput = { ...emptyInput };
      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );
      expect(result.current.suggestions).toEqual({});
    });

    it('single-currency groupId, null currency → suggests currency', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
      };
      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );
      expect(result.current.suggestions).toEqual({ fromCurrency: 'USD' });
    });

    it('single-currency groupId, valid currency → suggests accountId', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        fromCurrency: 'USD',
      };
      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );
      expect(result.current.suggestions).toEqual({ fromAccountId: 'acc-single-usd' });
    });

    it('single-currency groupId, invalid currency → suggests null accountId', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        fromCurrency: 'EUR', // Invalid
        fromAccountId: 'stale-id',
      };
      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );
      expect(result.current.suggestions).toEqual({ fromAccountId: null });
    });

    it('multi-currency groupId, null currency → no suggestions (user must choose)', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-multi',
      };
      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );
      expect(result.current.suggestions).toEqual({});
    });

    it('multi-currency groupId, valid currency (USD) → suggests accountId', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-multi',
        fromCurrency: 'USD',
      };
      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );
      expect(result.current.suggestions).toEqual({ fromAccountId: 'acc-multi-usd' });
    });

    it('multi-currency groupId, valid currency (PEN) → suggests accountId', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-multi',
        fromCurrency: 'PEN',
      };
      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );
      expect(result.current.suggestions).toEqual({ fromAccountId: 'acc-multi-pen' });
    });

    it('invalid groupId, any currency → no suggestions', () => {
      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'invalid-group',
        fromCurrency: 'USD',
      };
      const { result } = renderHook(() =>
        useTransferResolution(input, groupedAccounts, rawAccounts)
      );
      // No account found (groupId doesn't exist), but fromAccountId is null so no null suggestion
      expect(result.current.suggestions).toEqual({});
    });
  });

  describe('combined source and destination', () => {
    it('suggests both currencies when both single-currency accounts selected', () => {
      // Create a second single-currency group for destination
      const destGroup = createGroupedAccount('group-single-2', 'Wells Fargo', [
        { accountId: 'acc-single-2-usd', currency: 'USD', amountCents: 8000 },
      ]);
      const extendedGroups = [...groupedAccounts, destGroup];
      const extendedRaw = [
        ...rawAccounts,
        createRawAccount('acc-single-2-usd', 'group-single-2', 'USD'),
      ];

      const input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        toGroupId: 'group-single-2',
      };

      const { result } = renderHook(() =>
        useTransferResolution(input, extendedGroups, extendedRaw)
      );

      expect(result.current.suggestions).toEqual({
        fromCurrency: 'USD',
        toCurrency: 'USD',
      });
    });

    it('full transfer resolution chain: group → currency → accountId', () => {
      // Simulate the full resolution flow

      // Step 1: User selects groups
      let input: TransferResolutionInput = {
        ...emptyInput,
        fromGroupId: 'group-single',
        toGroupId: 'group-multi',
      };

      let { result, rerender } = renderHook(
        (props: TransferResolutionInput) =>
          useTransferResolution(props, groupedAccounts, rawAccounts),
        { initialProps: input }
      );

      // Should suggest fromCurrency (single-currency), but NOT toCurrency (multi)
      expect(result.current.suggestions).toEqual({ fromCurrency: 'USD' });

      // Step 2: Apply suggestions, user selects toCurrency
      input = {
        ...input,
        fromCurrency: 'USD',
        toCurrency: 'PEN', // User choice
      };
      rerender(input);

      // Now should suggest both accountIds
      expect(result.current.suggestions).toEqual({
        fromAccountId: 'acc-single-usd',
        toAccountId: 'acc-multi-pen',
      });

      // Step 3: Apply suggestions
      input = {
        ...input,
        fromAccountId: 'acc-single-usd',
        toAccountId: 'acc-multi-pen',
      };
      rerender(input);

      // No more suggestions - resolution complete
      expect(result.current.suggestions).toEqual({});
      expect(result.current.isSameCurrencyTransfer).toBe(false);
      expect(result.current.isLoopTransfer).toBe(false);
    });
  });
});
