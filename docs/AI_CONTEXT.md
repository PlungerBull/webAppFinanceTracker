# AI Context - Finance Tracker

> **Purpose:** Operational map for AI assistants. Updated per sprint. For architectural laws, see `MANIFESTO.md`.

---

## Current Mission

**Sprint Focus:** iOS Swift protocol mapping preparation and reliability hardening.

**Active Tasks:**
- Import optimization (fix timeouts on large Excel/CSV)
- Delta sync engine production readiness

**Recently Completed:**
- Ghost Prop Audit (S-Tier Continuous Constraint System)
- Volatility Engine for query caching
- Optimistic updates for categories
- Scalability guardrails for dashboard

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, **Client-Side Heavy**) |
| Language | TypeScript (Strict mode) |
| Database | Supabase (PostgreSQL) |
| Server State | TanStack Query v5 |
| Client State | Zustand |
| Styling | Tailwind CSS + Radix UI + Lucide Icons |
| Forms | React Hook Form + Zod |
| Dates | date-fns |

**CRITICAL:** This is NOT a traditional Next.js SSR app. All data fetching uses Supabase Client SDK from browser. Components are primarily Client Components (`"use client"`). Do NOT suggest Server Actions or API routes for data mutations.

---

## Project Structure

```
/app                 # Next.js routes only (thin wrappers)
/features            # Domain logic (THE CORE)
  /accounts          # Bank accounts & balances
  /categories        # Category taxonomy
  /transactions      # Core ledger (Repository Pattern)
  /inbox             # Staging area for drafts
  /reconciliations   # Bank statement matching
  /import-export     # CSV/Excel processing
  /settings          # User preferences
/domain              # Sacred entities (platform-agnostic, iOS-compatible)
/lib                 # Shared utilities
  /auth              # IAuthProvider abstraction
  /data              # Transformers, Zod schemas, validation
  /data-patterns     # DataResult<T> type definitions
  /sync              # Delta sync engine
  /hooks             # Cross-feature orchestrator hooks
  /constants         # App-wide constants
/components          # Shared UI
  /ui                # Shadcn/Radix primitives
  /shared            # FormModal, DeleteDialog, Tag
/types               # Global type definitions
  supabase.ts        # Generated database types
  domain.ts          # Frontend interfaces (camelCase)
/stores              # Zustand stores
/providers           # React Context providers
```

### Feature Module Pattern

```
features/[domain]/
├── domain/          # Entities, types, constants, errors
├── repository/      # Data access (Supabase/Local implementations)
├── services/        # Business logic (UUID, retry, auth)
├── hooks/           # React Query integration
├── components/      # Domain-specific UI
└── schemas/         # Zod validation
```

---

## Source of Truth References

| Concept | Location | Notes |
|---------|----------|-------|
| Database Schema | `types/supabase.ts` | Generated via `supabase gen types typescript` |
| Architectural Laws | `docs/MANIFESTO.md` | Zero-Any, Integer Cents, Result Pattern |
| Domain Entities | `domain/*.ts` | Platform-agnostic, includes Swift mirrors |
| Validation Schemas | `lib/data/db-row-schemas.ts` | Zod schemas at network boundary |
| Data Patterns | `lib/data-patterns/types.ts` | DataResult<T>, PaginatedResult |
| Error Classes | `lib/errors/domain-error.ts` | DomainError base class |
| Transformers | `lib/data/data-transformers.ts` | snake_case ↔ camelCase |

---

## Key Patterns (Quick Reference)

### Data Flow
```
UI → React Query Hook → Service Layer → Repository → Database
         ↓                    ↓              ↓
    Optimistic Updates   Business Logic   DECIMAL ↔ INT conversion
```

### Critical Rules

1. **Never return raw DB rows** — Always transform via `lib/data/data-transformers.ts`
2. **Integer cents only** — Domain uses `amountCents: 1050`, not `amount: 10.50`
3. **DataResult pattern** — Repositories return `{ success, data, error }`, never throw
4. **Write-then-Read** — Mutations insert to table, then fetch from view for cache
5. **useLeafCategories()** — Category selectors must filter out parent groupings

### Import Rules

- Features import from `@/lib` and `@/domain` — never from other features
- Cross-feature needs → use orchestrator hooks in `@/lib/hooks`
- Constants → import from `@/lib/constants` aggregator

---

## Active Constraints

### Known Issues
- setState-in-Effect anti-patterns pending cleanup
- See `docs/TODO.md` for tracked items

### Environment
- **Local:** `localhost:3000` with local Supabase
- **Dev:** `finance-tracker-dev.vercel.app` (branch: `dev`)
- **Prod:** `finance-tracker.vercel.app` (branch: `main`)

### Schema Changes
```bash
# Generate types after DB changes
supabase gen types typescript --project-id [id] > types/supabase.ts
```

---

## Sprint Notes

### Current Focus
- Import optimization: `features/import-export/`
- Ghost Prop prevention: `eslint.config.mjs` (domainStrictnessRules)

### Recently Added
- `docs/NATIVE_PORTING_GUIDE.md` - Swift protocol mapping reference
- `features/transactions/repository/sync-repository.interface.ts` - Phase 2 sync ops
- `lib/constants/query.constants.ts` - Volatility Engine
- `lib/utils/grouping-logic.ts` - Pure transformation engine

### Blocked Items
- Supabase type regeneration requires elevated access

---

*Last updated: 2026-02-01 | Ghost Prop Audit Complete*
