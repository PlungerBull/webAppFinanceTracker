# Finance Tracker Manifesto

Constitutional principles governing this codebase. Changes require team review.

> **Code-as-Truth Model:** If a rule can be enforced by TypeScript or a database constraint, it lives in the code, not here. This document covers the "why" and high-level "what" — the codebase is the source of truth for implementation.

---

## 1. The Zero-Any Mandate

**Status: NON-NEGOTIABLE**

The use of `any`, `unknown` (without a guard), and type-casting hacks like `undefined as any` is strictly prohibited.

### Why This Exists

1. **Silent Failure Prevention:** An `as any` cast masks type errors at compile time but causes runtime crashes in production.
2. **iOS Native Port:** Swift has no `any` equivalent that survives JSON serialization. TypeScript `any` becomes `nil` in Swift, causing cascading crashes.
3. **Financial Integrity:** A masked type error on `amountCents` can cause balance drift that's impossible to audit retroactively.

### Rules

**DO:**
- Use `DataResult<T>` with explicit `null` for empty success states
- Validate all external data with Zod before transformation
- Narrow `unknown` types with `instanceof` or type guards
- Regenerate database types when schema changes (`supabase gen types typescript`)

**DON'T:**
- Use `as any` to silence type errors
- Use `undefined as any` to satisfy return types
- Access properties on `unknown` without narrowing first
- Use `@ts-ignore` without a linked issue

### Enforcement

- ESLint: `@typescript-eslint/no-explicit-any` set to `error`
- TypeScript: `strict: true` in tsconfig.json
- CI/CD: Type errors block deployment

---

## 2. Financial Integrity (Sacred Integer Arithmetic)

**Problem:** Floating-point math causes balance drift (`0.1 + 0.2 !== 0.3`).

**Solution:** Domain entities use **integer cents only**. Conversion happens at service boundaries.

**Impact:** TypeScript and Swift produce identical balance calculations — zero drift.

### Rules

- Store all monetary amounts as INTEGER CENTS (`1050` not `10.50`)
- Use `toCents()` / `fromCents()` utilities at input/output boundaries
- Never perform floating-point arithmetic on money
- Database columns use `bigint` or `integer` for amounts

### Code Reference

See `lib/utils/cents-conversion.ts` for conversion utilities.

---

## 3. Offline-First Architecture

The system implements **Todoist-style offline sync** with version-based reconciliation.

### Data Flow

```
UI (Optimistic Update)
    ↓
Local Store (IndexedDB)
    ↓
Sync Engine (Delta Push/Pull)
    ↓
Remote Database (PostgreSQL)
```

### Core Mandates

| Mandate | Problem | Solution |
|---------|---------|----------|
| **Version-Based Sync** | Clock drift causes missed updates | Global monotonic version counter (no timestamps) |
| **Soft Deletes** | Hard deletes break offline sync | Set `deleted_at = NOW()` instead of DELETE |
| **Atomic Transfers** | Network interruption leaves ledger unbalanced | Single RPC creates both legs of transfer |
| **ISO 8601 Dates** | JavaScript is forgiving, Swift crashes | Repository validates date format with regex |

---

## 4. Result Pattern Contract

**Problem:** TypeScript's `try/catch` is too loose — iOS needs explicit contracts.

**Solution:** `DataResult<T>` wrapper with success/failure/conflict states.

```typescript
type DataResult<T, E = Error> =
  | { success: true; data: T; conflict?: boolean }
  | { success: false; data: null; error: E };
```

### Rules

- Repositories NEVER throw — they return `DataResult`
- Services handle conflicts with auto-retry (max 2 attempts)
- UI receives explicit success/failure states
- No try/catch at feature level — handle at service boundary

### Code Reference

See `lib/data-patterns/types.ts` for full type definitions with Swift mirrors.

---

## 5. Folder-by-Feature Organization

Group files by business domain, not by technical type.

### Structure

```
/app                 # Next.js routes only
/features            # Domain logic (the core of the app)
  /accounts          # Bank accounts & balances
  /categories        # Transaction categories
  /transactions      # Core ledger
  /inbox             # Staging area
  /reconciliations   # Bank statement matching
/domain              # Sacred entities (platform-agnostic)
/lib                 # Shared utilities
/components          # Shared UI
/types               # Global type definitions
```

### Feature Module Pattern

```
features/[domain]/
├── domain/          # Entities, types, constants, errors
├── repository/      # Data access layer (Supabase/Local)
├── services/        # Business logic layer
├── hooks/           # React Query integration
├── components/      # Domain-specific UI
└── schemas/         # Zod validation
```

### Import Rules

- Features import from `@/lib` and `@/domain` — never from other features
- Cross-feature orchestration happens via hooks in `@/lib/hooks`
- ESLint enforces import boundaries

---

## 6. Entity Relationships

High-level data model. For column definitions, see `types/supabase.ts`.

```
User
  ├── Accounts (1:N) ─┬─ Transactions (1:N)
  │                   └─ Reconciliations (1:N)
  ├── Categories (1:N, hierarchical 2-level max)
  ├── Settings (1:1)
  └── Inbox (1:N, staging area)
```

### Key Constraints

- **One Currency Per Account:** Multi-currency uses `group_id` pattern
- **Category Hierarchy:** 2-level max (parent/child), enforced by database trigger
- **Soft Deletes:** All entities use `deleted_at` for tombstone pattern
- **Version Control:** All synced entities have `version` field

---

## 7. Serialization Boundary Contract

**Status: NON-NEGOTIABLE**

**Problem:** Ghost props in ViewEntities cause unnecessary JSON parsing overhead on the iOS bridge. Every unused property adds serialization latency and Swift protocol bloat.

### Rules

Every property in a ViewEntity MUST be:
1. **Rendered in a UI component**, OR
2. **Used in business logic**, OR
3. **Marked `@deprecated` with removal timeline**

Properties that exist "just in case" or "for future use" are violations.

### Enforcement

| Method | Frequency |
|--------|-----------|
| ESLint domain strictness rules | Continuous (CI) |
| Semi-annual Ghost Prop Audit | January, July |
| Code review checklist | Per PR |

### Code Reference

See `docs/NATIVE_PORTING_GUIDE.md` for the canonical property inventory and Swift struct templates.

### Violation Resolution

1. Identify unused property via grep (zero `.propName` references in components/hooks)
2. Add `@deprecated` JSDoc with target removal date
3. Create migration (if database field) or PR (if TypeScript-only)
4. Remove in following audit cycle

---

## Code References

| Concept | Source of Truth |
|---------|-----------------|
| Database Schema | `types/supabase.ts` (generated) |
| Domain Entities | `domain/*.ts` (with Swift mirrors) |
| Data Patterns | `lib/data-patterns/types.ts` |
| Validation Schemas | `lib/data/db-row-schemas.ts` |
| Error Classes | `lib/errors/domain-error.ts` |
| Native Porting Guide | `docs/NATIVE_PORTING_GUIDE.md` |

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-31 | Initial creation from ARCHITECTURE.md extraction | Infrastructure Reset |
