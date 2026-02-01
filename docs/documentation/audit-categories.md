# Composable Manifest: features/categories

> **Generated**: 2026-02-01
> **Auditor**: Claude (Senior Systems Architect)
> **Scope**: `/features/categories/` folder
> **Status**: PASS WITH WARNINGS
> **Grade**: A-

---

## Executive Summary

| Metric | Result |
|--------|--------|
| Cross-Feature Violations | 0 |
| Zero-Any Violations | 0 |
| Spaghetti Violations | 0 |
| Ghost Props | 2 (`createdAt`, `updatedAt`) |
| Schema Drift | Minor (sync fields ahead of generated types) |
| Integer Cents | N/A (no monetary values) |
| DataResult Pattern | PASS |
| Boundary Mapping | PASS |

---

## 1. Dependency Map

### 1.1 File Inventory

```
features/categories/
├── domain/
│   ├── constants.ts
│   ├── entities.ts
│   ├── errors.ts
│   ├── index.ts
│   └── types.ts
├── repository/
│   ├── category-repository.interface.ts
│   ├── hybrid-category-repository.ts
│   ├── index.ts
│   ├── local-category-repository.ts
│   └── supabase-category-repository.ts
├── services/
│   ├── category-service.interface.ts
│   ├── category-service.ts
│   └── index.ts
├── hooks/
│   ├── use-categories.ts
│   ├── use-categorized-categories.ts
│   ├── use-category-mutations.ts
│   ├── use-category-service.ts
│   └── use-leaf-categories.ts
└── components/
    ├── add-category-modal.tsx
    ├── category-form.tsx
    ├── category-list.tsx
    ├── delete-category-dialog.tsx
    └── edit-grouping-modal.tsx
```

**Total Files**: 20 (excluding index.ts barrel exports)

### 1.2 Import Categories

#### External Packages (NPM)

| Package | Usage |
|---------|-------|
| `react` | Hooks (useState, useMemo, useEffect, useCallback, useRef) |
| `react-hook-form` | Form state management |
| `@hookform/resolvers/zod` | Form validation |
| `zod` | Schema validation |
| `@tanstack/react-query` | Data fetching (useQuery, useMutation, useQueryClient) |
| `next/navigation` | Routing (useRouter, useSearchParams) |
| `lucide-react` | Icons |
| `sonner` | Toast notifications |
| `@radix-ui/react-dialog` | Dialog primitives |
| `@radix-ui/react-visually-hidden` | A11y |
| `@supabase/supabase-js` | Supabase client types |
| `@nozbe/watermelondb` | Local database (offline-first) |

#### Project Imports - ALLOWED

| Import Source | Files Using | Purpose |
|---------------|-------------|---------|
| `@/domain/categories` | 3 | Sacred Domain types |
| `@/lib/constants` | 6 | QUERY_KEYS, CATEGORY, VALIDATION constants |
| `@/lib/utils` | 4 | cn() utility |
| `@/lib/data/data-transformers` | 1 | dbCategoryToDomain, dbParentCategoryWithCountToDomain |
| `@/lib/data/db-row-schemas` | 1 | CategoryRowSchema, ParentCategoryWithCountRowSchema |
| `@/lib/data/validate` | 1 | validateOrThrow, validateArrayOrThrow |
| `@/lib/data-patterns` | 1 | DataResult type |
| `@/lib/errors` | 1 | DomainError base class |
| `@/lib/supabase/client` | 1 | createClient |
| `@/lib/auth/supabase-auth-provider` | 1 | createSupabaseAuthProvider |
| `@/lib/auth/auth-provider.interface` | 1 | IAuthProvider type |
| `@/lib/local-db` | 2 | useLocalDatabase, SyncStatus |
| `@/lib/sync/sync-lock-manager` | 1 | checkAndBufferIfLocked, getSyncLockManager |
| `@/lib/data/local-data-transformers` | 1 | localCategoryToDomain |
| `@/lib/hooks/use-category-operations` | 2 | useCategoryOperations |
| `@/types/supabase` | 3 | Database types |
| `@/types/domain` | 1 | CategoryWithCount type |
| `@/components/ui/*` | 5 | Button, Input, Label, Popover, etc. |
| `@/components/shared/*` | 2 | ColorPicker, DeleteDialog |
| `@/stores/auth-store` | 1 | useAuthStore |

#### Relative Imports (within feature)

| Pattern | Usage |
|---------|-------|
| `../domain` | Type imports in hooks/components |
| `../hooks/*` | Hook composition |
| `../repository/*` | Repository implementation imports |
| `../services/*` | Service layer imports |
| `./*` | Sibling file imports |

### 1.3 Cross-Feature Violations

| Import Pattern | Occurrences | Status |
|----------------|-------------|--------|
| `@/features/*` (other features) | 0 | PASS |

**Finding**: No cross-feature import violations detected. All feature dependencies flow through `@/lib/*` and `@/domain/*` as mandated by the Manifesto.

---

## 2. Schema Compliance

### 2.1 Zod Schema Definition

**File**: `lib/data/db-row-schemas.ts` (lines 116-127)

```typescript
export const CategoryRowSchema = z.object({
  id: uuid,
  user_id: uuid.nullable(),
  name: z.string(),
  type: TransactionTypeEnum,        // 'expense' | 'income' | 'transfer' | 'opening_balance' | 'adjustment'
  color: z.string(),
  parent_id: uuid.nullable(),
  created_at: timestamptz,
  updated_at: timestamptz,
  // Sync fields — required at boundary (Delta Sync Engine needs defined values)
  version: z.number().int().min(0),
  deleted_at: z.string().nullable(),
});
```

### 2.2 Supabase Generated Type

**File**: `types/database.types.ts` (lines 92-102)

```typescript
categories: {
  Row: {
    color: string
    created_at: string
    id: string
    name: string
    parent_id: string | null
    type: Database["public"]["Enums"]["transaction_type"]
    updated_at: string
    user_id: string | null
  }
  // Insert and Update omitted for brevity
}
```

### 2.3 Field Comparison Matrix

| Field | Zod Schema | Supabase Types | Match |
|-------|------------|----------------|-------|
| `id` | `uuid` | `string` | YES |
| `user_id` | `uuid.nullable()` | `string \| null` | YES |
| `name` | `z.string()` | `string` | YES |
| `type` | `TransactionTypeEnum` | `transaction_type` enum | YES |
| `color` | `z.string()` | `string` | YES |
| `parent_id` | `uuid.nullable()` | `string \| null` | YES |
| `created_at` | `timestamptz` | `string` | YES |
| `updated_at` | `timestamptz` | `string` | YES |
| `version` | `z.number().int().min(0)` | **MISSING** | DRIFT |
| `deleted_at` | `z.string().nullable()` | **MISSING** | DRIFT |

### 2.4 Sync Field Status

| Field | Status | Note |
|-------|--------|------|
| `version` | In Zod, not in generated types | Added by migration `20260126000001_categories_sync_hardening.sql` |
| `deleted_at` | In Zod, not in generated types | Added by migration for tombstone pattern |

**Finding**: Schema drift detected. Zod schema includes sync fields that were added by migration but `database.types.ts` has not been regenerated. This is a **minor drift** - the Zod schema is the authoritative source.

**Recommendation**: Run `npx supabase gen types typescript` to regenerate types.

---

## 3. Entity Audit (Ghost Prop Audit)

### 3.1 CategoryEntity

**Source**: `domain/categories.ts` (lines 47-92)

| Property | Type | UI Component Usage | Business Logic Usage | Status |
|----------|------|-------------------|---------------------|--------|
| `id` | `string` | category-list.tsx (key, selection), delete-category-dialog.tsx, all modals | All CRUD operations, cache keys | **ACTIVE** |
| `userId` | `string` | N/A (RLS handles) | Repository auth context, mutation guard | **ACTIVE** |
| `name` | `string` | category-list.tsx (display), category-form.tsx (input), all modals | Create/Update DTOs, validation | **ACTIVE** |
| `color` | `string` | category-list.tsx (icon styling), category-form.tsx (picker), modals | Create/Update DTOs, inheritance | **ACTIVE** |
| `type` | `CategoryType` | add-category-modal.tsx (toggle), edit-grouping-modal.tsx | Type inheritance to children | **ACTIVE** |
| `parentId` | `string \| null` | category-list.tsx (tree building) | Hierarchy operations, reassignment | **ACTIVE** |
| `createdAt` | `string` | **NONE** | Repository entity construction only | **GHOST** |
| `updatedAt` | `string` | **NONE** | Repository entity construction, optimistic updates | **GHOST** |
| `version` | `number` | Passed to mutation hooks | Optimistic concurrency control | **ACTIVE** |
| `deletedAt` | `string \| null` | N/A | Tombstone filtering in queries | **ACTIVE (Sync)** |

### 3.2 GroupingEntity

**Source**: `features/categories/domain/entities.ts` (lines 66-106)

| Property | Type | UI Component Usage | Business Logic Usage | Status |
|----------|------|-------------------|---------------------|--------|
| `id` | `string` | edit-grouping-modal.tsx | All operations | **ACTIVE** |
| `userId` | `string` | N/A | Repository auth | **ACTIVE** |
| `name` | `string` | edit-grouping-modal.tsx | CRUD | **ACTIVE** |
| `color` | `string` | edit-grouping-modal.tsx | CRUD, inheritance | **ACTIVE** |
| `type` | `CategoryType` | edit-grouping-modal.tsx | Type toggle | **ACTIVE** |
| `createdAt` | `string` | **NONE** | Repository only | **GHOST** |
| `updatedAt` | `string` | **NONE** | Repository only | **GHOST** |
| `version` | `number` | edit-grouping-modal.tsx (mutation) | Optimistic CC | **ACTIVE** |
| `deletedAt` | `string \| null` | N/A | Tombstone filter | **ACTIVE (Sync)** |
| `childCount` | `number` | edit-grouping-modal.tsx (subcategories.length) | Deletion validation | **ACTIVE** |
| `totalTransactionCount` | `number` | N/A | Deletion validation (canDelete) | **ACTIVE** |

### 3.3 LeafCategoryEntity

**Source**: `domain/categories.ts` (lines 110-116)

| Property | Type | UI Component Usage | Business Logic Usage | Status |
|----------|------|-------------------|---------------------|--------|
| (inherits CategoryEntity) | - | - | - | - |
| `isOrphanedParent` | `boolean` | **NONE** | Repository filtering logic | **ACTIVE** |

### 3.4 CategoryWithCountEntity

**Source**: `features/categories/domain/entities.ts` (lines 34-37)

| Property | Type | UI Component Usage | Business Logic Usage | Status |
|----------|------|-------------------|---------------------|--------|
| (inherits CategoryEntity) | - | - | - | - |
| `transactionCount` | `number` | category-list.tsx (badge), delete-category-dialog.tsx | Deletion validation | **ACTIVE** |

### 3.5 Ghost Prop Summary

| Entity | Ghost Props | Justification | Recommendation |
|--------|-------------|---------------|----------------|
| CategoryEntity | `createdAt`, `updatedAt` | Not displayed in UI; used only in repository entity construction | Mark as "Future Use - Audit Trail" |
| GroupingEntity | `createdAt`, `updatedAt` | Not displayed in UI; used only in repository entity construction | Mark as "Future Use - Audit Trail" |

**CTO Mandate Reference** (MANIFESTO.md):
> "Every property in a ViewEntity MUST be: (1) Rendered in a UI component, OR (2) Used in business logic, OR (3) Marked @deprecated with removal timeline"

**Finding**: `createdAt` and `updatedAt` are used in repository entity construction and optimistic updates but never rendered in UI. They serve as audit trail fields for the future. Per the Manifesto, they should be documented as "Future Use" or marked with `@deprecated` if removal is planned.

---

## 4. Local "Spaghetti" Report

### 4.1 Component Analysis Matrix

| Component | File | Direct DB Calls | Business Logic Leakage | Data Transformation | Status |
|-----------|------|-----------------|----------------------|---------------------|--------|
| CategoryList | category-list.tsx | None | Tree building in useMemo (UI-specific) | None | **CLEAN** |
| AddCategoryModal | add-category-modal.tsx | None | Zod form schema (acceptable) | None | **CLEAN** |
| EditGroupingModal | edit-grouping-modal.tsx | None | Subcategory filter in useMemo (UI-specific) | None | **CLEAN** |
| DeleteCategoryDialog | delete-category-dialog.tsx | None | Uses ICategoryOperations.canDelete() | None | **CLEAN** |
| CategoryForm | category-form.tsx | None | Pure presentational | None | **CLEAN** |

### 4.2 Analysis Details

#### category-list.tsx
- **Tree Building Logic** (lines ~72-103): Uses `useMemo` to build hierarchical tree from flat category array. This is **UI-specific presentation logic**, not business logic.
- **Navigation Logic**: Standard Next.js router usage.
- **Data Source**: `useCategoriesWithCounts()` hook.

#### add-category-modal.tsx
- **Form Validation**: Inline Zod schema for form validation is **acceptable** at component level.
- **Mutation**: Delegates to `useCreateGroupingMutation()` hook.

#### edit-grouping-modal.tsx
- **Subcategory Filtering**: `useMemo` filter for children is **UI-specific**.
- **Mutations**: Delegates to `useUpdateGroupingMutation()`, `useReassignSubcategoryMutation()`.

#### delete-category-dialog.tsx
- **Constraint Checking**: Uses `useCategoryOperations().canDelete()` - properly delegated to IoC interface.
- **Delete Action**: Delegates to `useDeleteCategory()` hook.

#### category-form.tsx
- **Pure Presentational**: Receives all data via props, no internal logic.

### 4.3 Violations Summary

| Violation Type | Count | Details |
|----------------|-------|---------|
| Direct Supabase calls in components | 0 | N/A |
| Business logic in components | 0 | N/A |
| Data transformation in components | 0 | N/A |
| Validation logic outside DTOs/service | 0 | Form schemas acceptable |

**Finding**: Zero spaghetti violations. All business logic is properly encapsulated:
- **Service Layer** (`category-service.ts`): Validation, orchestration, auth context
- **Repository Layer**: Data access, error mapping, transformation
- **Hooks Layer**: React Query integration, optimistic updates, cache management
- **Components**: Pure presentation and event handling

---

## 5. Architectural Patterns Detected

### 5.1 S-Tier Pure Logic
- Pure validation methods in service (`validateDeletion`, `validateHierarchyChange`)
- No DB calls in validation logic
- Enables <1ms unit tests and iOS Swift port

### 5.2 Orchestrator Rule
- Service returns null until ready
- Queries use `enabled: !!service` flag
- Prevents race conditions during initialization

### 5.3 Optimistic Concurrency Control
- Every write includes `version` field
- Version checked via RPC (`update_category_with_version`, `delete_category_with_version`)
- Returns `CategoryVersionConflictError` on conflict

### 5.4 Tombstone Pattern
- Soft delete via `deleted_at` timestamp
- All queries filter `is('deleted_at', null)`
- Enables distributed sync and offline-first

### 5.5 DataResult Pattern
- All repository methods return `DataResult<T>` (never throw)
- Service layer unwraps and throws typed errors
- Enables caller choice: DataResult or throw semantics

### 5.6 Hybrid Repository
- Local-first reads/writes (WatermelonDB)
- Remote-only for merge operations
- Graceful degradation to Supabase-only

---

## 6. Recommendations

### 6.1 Immediate Actions

| Priority | Action | Effort |
|----------|--------|--------|
| P2 | Regenerate `database.types.ts` to include sync fields | Low |
| P3 | Add JSDoc `@future` annotation to `createdAt`/`updatedAt` | Low |

### 6.2 Future Considerations

| Item | Rationale |
|------|-----------|
| Display `createdAt` in category detail view | Audit trail visibility |
| Add "Last modified" indicator | User awareness of recent changes |

---

## 7. Compliance Checklist

| Rule | Status | Evidence |
|------|--------|----------|
| Integer Cents Only | N/A | No monetary values in categories domain |
| Result Pattern (DataResult<T>) | PASS | All repository methods return DataResult |
| Zero-Any Policy | PASS | Grep search: 0 matches for `any`, `as any`, `@ts-ignore` |
| Boundary Mapping | PASS | Transformations in `lib/data/data-transformers.ts` |
| No Cross-Feature Imports | PASS | Only `@/lib/*` and `@/domain/*` imports |
| Business Logic Placement | PASS | Service/Repository layers only |

---

## Appendix: Files Analyzed

```
features/categories/domain/constants.ts
features/categories/domain/entities.ts
features/categories/domain/errors.ts
features/categories/domain/index.ts
features/categories/domain/types.ts
features/categories/repository/category-repository.interface.ts
features/categories/repository/hybrid-category-repository.ts
features/categories/repository/index.ts
features/categories/repository/local-category-repository.ts
features/categories/repository/supabase-category-repository.ts
features/categories/services/category-service.interface.ts
features/categories/services/category-service.ts
features/categories/services/index.ts
features/categories/hooks/use-categories.ts
features/categories/hooks/use-categorized-categories.ts
features/categories/hooks/use-category-mutations.ts
features/categories/hooks/use-category-service.ts
features/categories/hooks/use-leaf-categories.ts
features/categories/components/add-category-modal.tsx
features/categories/components/category-form.tsx
features/categories/components/category-list.tsx
features/categories/components/delete-category-dialog.tsx
features/categories/components/edit-grouping-modal.tsx
```
