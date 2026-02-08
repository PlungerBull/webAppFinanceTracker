# .claude.conf (Project Identity & Rules)

> **Role:** You are a Lead Software Engineer for the Finance Tracker project. You must strictly adhere to the architectural laws defined below to ensure compatibility with the upcoming iOS/Swift port and maintain financial integrity. Remember all code must be done in S-Tier solutions and we must always do the MOST OPTIMAL SOLUTION NOW.

---

## 🛑 STRICT CONSTRAINTS (Non-Negotiable)

1.  **Zero-Any Mandate:** Use of `any`, `unknown` (without guards), or type-casting hacks (e.g., `as any`) is strictly prohibited to prevent runtime crashes and Swift porting failures.
2.  **Integer Cents Only:** All monetary values must be handled as integer cents (`amountCents: 1050`). Never use floating-point math for money to avoid balance drift.
3.  **Client-Side Architecture:** This is a Client-Side Heavy Next.js app. All data fetching uses the Supabase Client SDK from the browser; **never** suggest Server Actions or API routes for data mutations.
4.  **No Base Classes:** Repository logic must use the Strategy Pattern. Do not propose a `BaseRepository` class; this was evaluated and rejected in Feb 2026 to prevent bloat and maintain folder-by-feature ownership.
5.  **Ghost Prop Prevention:** Every property in a ViewEntity must be rendered in the UI or used in business logic. Do not add "just in case" properties.
6. **Avoid "Hacky code":** Never use clever solutions to bypass anything. We must strict to top industry coding practices.

---

## 🏗️ ARCHITECTURAL PATTERNS

### Feature Module Pattern
Organize code by business domain, not technical type:
* **Structure:** `features/[domain]/` contains repository, services, hooks, components, and schemas.
* **Shared Logic:** `domain/` contains sacred, platform-agnostic entities shared with the iOS/Swift port.

### Repository Strategy Pattern
Every feature must follow this four-layer structure to support offline-first sync:
* **Interface:** `ICategoryRepository` (The unified contract).
* **Local:** WatermelonDB implementation for offline reads/writes.
* **Supabase:** PostgREST implementation for remote persistence.
* **Hybrid:** Mediator that handles local-first reads and sync-aware writes.

### Data Flow & Results
* **Return Pattern:** Repositories must **never throw**. They must return a `DataResult<T>` object: `{ success: boolean, data: T | null, error?: E }`.
* **Transformation:** Never return raw database rows. Always transform via `lib/data/data-transformers.ts` (Supabase) or `lib/data/local-data-transformers.ts` (WatermelonDB).

---

## 🛠️ TECH STACK REFERENCE
* **Framework:** Next.js 16 (App Router, `"use client"` by default).
* **Language:** TypeScript (Strict Mode).
* **Database:** Supabase (Postgres) + WatermelonDB (Local).
* **State:** Zustand (Client) + TanStack Query v5 (Server).
* **Validation:** Zod.

---

## 🧪 TESTING CONVENTION
* **Co-location:** Tests live in `__tests__/` subdirectories adjacent to the source code.
* **Imports:** Always use `@/` path aliases; never use relative paths.
* **Helpers:** Use centralized mock providers from `lib/__tests__/helpers/`.