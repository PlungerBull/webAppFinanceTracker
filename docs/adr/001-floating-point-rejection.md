# ADR 001: Floating-Point Rejection for Currency Amounts

## Status

Accepted

## Date

2026-01-17

## Context

Financial applications require precise currency calculations. JavaScript's IEEE 754
floating-point representation introduces rounding errors that are unacceptable for
monetary values. For example:

```javascript
0.1 + 0.2 === 0.30000000000000004  // true (unexpected!)
1.15 * 100 === 114.99999999999999  // true (wrong!)
```

This rounding error compounds across thousands of transactions, leading to:
- Balance discrepancies
- Failed reconciliations
- Loss of user trust

## Decision

**All currency amounts are stored and processed as integers representing cents (or the
smallest currency unit).**

### Rules

1. **Database**: `amount_cents BIGINT NOT NULL` - never `DECIMAL` or `FLOAT`
2. **TypeScript**: `amountCents: number` - always an integer
3. **API**: All amounts transmitted as integers
4. **UI**: Format to decimal only at display time using `formatCents()`

### The Sacred `toCents()` Implementation

Located in `features/transactions/repository/supabase-transaction-repository.ts:74-109`:

```typescript
private toCents(decimal: number | string | null): number {
  if (decimal === null || decimal === undefined) {
    return 0;
  }

  // CRITICAL: Parse as STRING to avoid floating-point contamination
  const str = typeof decimal === 'string' ? decimal : decimal.toString();
  const isNegative = str.startsWith('-');
  const absStr = isNegative ? str.slice(1) : str;

  const parts = absStr.split('.');
  const wholePart = parts[0] || '0';
  let fractionalPart = parts[1] || '00';

  // Normalize to 2 decimal places with banker's rounding
  if (fractionalPart.length === 1) {
    fractionalPart = fractionalPart + '0';
  } else if (fractionalPart.length > 2) {
    const thirdDigit = parseInt(fractionalPart[2], 10);
    let cents = parseInt(fractionalPart.slice(0, 2), 10);
    if (thirdDigit >= 5) {
      cents += 1;
    }
    fractionalPart = cents.toString().padStart(2, '0');
  }

  // Pure integer arithmetic - SAFE
  const cents = parseInt(wholePart, 10) * 100 + parseInt(fractionalPart, 10);
  return isNegative ? -cents : cents;
}
```

### Why `Math.round(dollars * 100)` is UNSAFE

```javascript
Math.round(19.99 * 100)  // 1999 (correct by luck)
Math.round(0.29 * 100)   // 29 (correct by luck)
Math.round(1.005 * 100)  // 100 (WRONG! Should be 101)
Math.round(35.855 * 100) // 3585 (WRONG! Should be 3586)
```

The multiplication `dollars * 100` introduces IEEE 754 drift BEFORE `Math.round()`
can attempt correction. String parsing avoids binary float contamination entirely.

### Data Flow

```
UI Input ("10.50") -> DTO (1050) -> Service -> Repository -> DB (BIGINT 1050)
                                                                      |
UI Display ("<-10.50") <- formatCents(1050) <- Repository <- DB (BIGINT 1050)
```

## Consequences

### Positive

- Zero floating-point errors in financial calculations
- Predictable behavior across all platforms (Web, iOS, Android)
- Database indexes work efficiently on integers
- Simpler arithmetic operations
- Cross-platform portability (Swift uses same pattern)

### Negative

- Developers must remember to convert at boundaries
- Display formatting required at every UI touchpoint
- Legacy code migrations require careful auditing

## Enforcement

- **Code Review**: Any PR introducing `DECIMAL`, `FLOAT`, or `Math.round(dollars * 100)`
  for currency is an automatic reject
- **Type Safety**: DTOs use `amountCents: number` with JSDoc indicating integer
- **Repository Layer**: All conversions happen in repository, never in service/UI

## References

- [Why Not Just Use Float for Currency?](https://stackoverflow.com/questions/3730019/why-not-use-double-or-float-to-represent-currency)
- [PostgreSQL: Don't Use MONEY Type](https://wiki.postgresql.org/wiki/Don%27t_Do_This#Don.27t_use_money)
- [IEEE 754 Double Precision](https://en.wikipedia.org/wiki/Double-precision_floating-point_format)
