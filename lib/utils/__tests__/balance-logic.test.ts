import {
  calculateBalanceDeltas,
  calculateDeleteDelta,
  calculateCreateDelta,
  toCents,
  fromCents,
} from '../balance-logic';

describe('Balance calculation logic', () => {
  describe('calculateBalanceDeltas', () => {
    it('should handle amount change (same account)', () => {
      const deltas = calculateBalanceDeltas(
        { accountId: 'acc1', amountOriginal: 100.50 },
        { accountId: 'acc1', amountOriginal: 150.75 }
      );

      expect(deltas).toEqual([{
        accountId: 'acc1',
        deltaCents: 5025, // 150.75 - 100.50 = 50.25 * 100 = 5025 cents
      }]);
    });

    it('should handle account change (move transaction)', () => {
      const deltas = calculateBalanceDeltas(
        { accountId: 'acc1', amountOriginal: 100.00 },
        { accountId: 'acc2', amountOriginal: 100.00 }
      );

      expect(deltas).toEqual([
        { accountId: 'acc1', deltaCents: -10000 }, // Subtract from old
        { accountId: 'acc2', deltaCents: 10000 },  // Add to new
      ]);
    });

    it('should handle both amount and account change', () => {
      const deltas = calculateBalanceDeltas(
        { accountId: 'acc1', amountOriginal: 50.00 },
        { accountId: 'acc2', amountOriginal: 75.50 }
      );

      expect(deltas).toEqual([
        { accountId: 'acc1', deltaCents: -5000 },  // Subtract old amount from old account
        { accountId: 'acc2', deltaCents: 7550 },   // Add new amount to new account
      ]);
    });

    it('should prevent floating-point errors', () => {
      const deltas = calculateBalanceDeltas(
        { accountId: 'acc1', amountOriginal: 0.1 },
        { accountId: 'acc1', amountOriginal: 0.2 }
      );

      expect(deltas[0].deltaCents).toBe(10); // NOT 0.30000000000000004
    });

    it('should handle negative amounts (refunds)', () => {
      const deltas = calculateBalanceDeltas(
        { accountId: 'acc1', amountOriginal: -50.00 },
        { accountId: 'acc1', amountOriginal: -75.00 }
      );

      expect(deltas).toEqual([{
        accountId: 'acc1',
        deltaCents: -2500, // -75.00 - (-50.00) = -25.00
      }]);
    });

    it('should handle zero delta (no change)', () => {
      const deltas = calculateBalanceDeltas(
        { accountId: 'acc1', amountOriginal: 100.00 },
        { accountId: 'acc1', amountOriginal: 100.00 }
      );

      expect(deltas).toEqual([{
        accountId: 'acc1',
        deltaCents: 0,
      }]);
    });
  });

  describe('calculateDeleteDelta', () => {
    it('should subtract amount from account', () => {
      const delta = calculateDeleteDelta({
        accountId: 'acc1',
        amountOriginal: 150.75,
      });

      expect(delta).toEqual({
        accountId: 'acc1',
        deltaCents: -15075, // Always negative (removing from balance)
      });
    });

    it('should handle negative amounts on delete', () => {
      const delta = calculateDeleteDelta({
        accountId: 'acc1',
        amountOriginal: -50.00,
      });

      expect(delta).toEqual({
        accountId: 'acc1',
        deltaCents: 5000, // Deleting a negative amount increases balance
      });
    });
  });

  describe('calculateCreateDelta', () => {
    it('should add amount to account', () => {
      const delta = calculateCreateDelta({
        accountId: 'acc1',
        amountOriginal: 150.75,
      });

      expect(delta).toEqual({
        accountId: 'acc1',
        deltaCents: 15075, // Always positive (adding to balance)
      });
    });

    it('should handle negative amounts on create', () => {
      const delta = calculateCreateDelta({
        accountId: 'acc1',
        amountOriginal: -50.00,
      });

      expect(delta).toEqual({
        accountId: 'acc1',
        deltaCents: -5000, // Creating a negative amount decreases balance
      });
    });
  });

  describe('toCents and fromCents', () => {
    it('should convert dollars to cents correctly', () => {
      expect(toCents(100.50)).toBe(10050);
      expect(toCents(0.99)).toBe(99);
      expect(toCents(1.01)).toBe(101);
    });

    it('should convert cents to dollars correctly', () => {
      expect(fromCents(10050)).toBe(100.50);
      expect(fromCents(99)).toBe(0.99);
      expect(fromCents(101)).toBe(1.01);
    });

    it('should round correctly for sub-cent amounts', () => {
      // Edge case: Database stores 4 decimal places, but we work in cents
      expect(toCents(100.005)).toBe(10001); // Rounds to 100.01
      expect(toCents(100.004)).toBe(10000); // Rounds to 100.00
    });

    it('should prevent floating-point accumulation errors', () => {
      const value1 = 0.1;
      const value2 = 0.2;

      // Direct JS addition has floating-point error
      expect(value1 + value2).not.toBe(0.3);

      // Using cents arithmetic prevents the error
      const result = fromCents(toCents(value1) + toCents(value2));
      expect(result).toBe(0.3);
    });
  });
});
