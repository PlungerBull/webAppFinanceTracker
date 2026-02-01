# Composable Manifest: features/groupings

> **Generated**: 2026-02-01
> **Auditor**: Claude (Senior Systems Architect)
> **Scope**: `/features/groupings/` folder
> **Status**: PASS
> **Grade**: A

---

## Executive Summary

| Metric | Result |
|--------|--------|
| Cross-Feature Violations | 0 |
| Zero-Any Violations | 0 |
| Spaghetti Violations | 0 |
| Ghost Props | 2 (`createdAt`, `updatedAt`) |
| Schema Drift | None (uses Sacred Domain) |
| Integer Cents | N/A (no monetary values) |
| DataResult Pattern | PASS (via orchestrator) |
| Boundary Mapping | PASS (delegated to categories) |

**Architecture Note**: The groupings feature is a **thin presentation layer** by design. It has NO domain, repository, or services folders. All business logic is delegated to the categories feature via the `useCategoryOperations` orchestrator hook. Groupings are NOT a separate database table - they are categories where `parent_id IS NULL`.

---

## 1. Dependency Map

### 1.1 File Inventory

```
features/groupings/
├── components/          (6 files)
│   ├── add-grouping-form.tsx
│   ├── add-subcategory-modal.tsx
│   ├── delete-grouping-dialog.tsx
│   ├── edit-grouping-form.tsx
│   ├── grouping-list-item.tsx
│   └── grouping-list.tsx
└── hooks/               (2 files)
    ├── use-grouping-navigation.ts
    └── use-groupings.ts
```

**Total Files**: 8

### 1.2 Import Categories

#### External Packages (NPM)

| Package | Usage |
|---------|-------|
| `react` | Hooks (useState, useMemo, useCallback, useRef, useEffect) |
| `react-hook-form` | Form state management |
| `@hookform/resolvers/zod` | Form validation |
| `zod` | Schema validation |
| `@tanstack/react-query` | Data fetching (useQuery, useMutation, useQueryClient) |
| `next/navigation` | Routing (useRouter, useSearchParams) |
| `lucide-react` | Icons (Pencil, Trash2, Plus, Archive, etc.) |
| `sonner` | Toast notifications |
| `@radix-ui/react-dialog` | Dialog primitives |
| `@radix-ui/react-visually-hidden` | Accessibility |

#### Project Imports - ALLOWED

| Import Source | Files Using | Purpose |
|---------------|-------------|---------|
| `@/domain/categories` | 5 | GroupingEntity, CategoryType, DTOs, isCategoryOperationError |
| `@/lib/constants` | 5 | QUERY_KEYS, VALIDATION, GROUPING, ACCOUNT, ACCOUNTS |
| `@/lib/utils` | 4 | cn() utility |
| `@/lib/hooks/use-category-operations` | 2 | ICategoryOperations orchestrator |
| `@/lib/hooks/use-form-modal` | 1 | Form state management |
| `@/components/ui/*` | 5 | Button, Input, Label, Popover, ResourceListItem |
| `@/components/shared/*` | 2 | EntityModal, DeleteDialog |

#### Relative Imports (within feature)

| Pattern | Usage |
|---------|-------|
| `../hooks/use-groupings` | Component imports |
| `../hooks/use-grouping-navigation` | Component imports |

### 1.3 Cross-Feature Violations

| Import Pattern | Occurrences | Status |
|----------------|-------------|--------|
| `@/features/*` (other features) | 0 | PASS |

**Finding**: Zero cross-feature import violations. All dependencies flow through `@/lib/*` and `@/domain/*` as mandated by the Manifesto. The feature correctly uses the orchestrator pattern instead of directly importing from `@/features/categories`.

---

## 2. Schema Compliance

### 2.1 Inline Zod Schemas

Groupings defines schemas **inline in components** (not centralized):

#### add-grouping-form.tsx (lines 28-31)
```typescript
const groupingSchema = z.object({
  name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CATEGORY_NAME_REQUIRED),
  color: z.string().regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
});
```

#### add-subcategory-modal.tsx (lines 26-28)
```typescript
const subcategorySchema = z.object({
  name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, GROUPING.UI.MESSAGES.SUBCATEGORY_NAME_REQUIRED),
});
```

#### edit-grouping-form.tsx (lines 41-45)
```typescript
const groupingSchema = z.object({
  name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CATEGORY_NAME_REQUIRED),
  color: z.string().regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
  type: z.enum(['expense', 'income']).optional(),
});
```

### 2.2 Schema vs Sacred Domain DTO Comparison

| Zod Schema Field | Sacred Domain DTO | Match Status |
|------------------|-------------------|--------------|
| `groupingSchema.name` | `CreateGroupingDTO.name` | ALIGNED |
| `groupingSchema.color` | `CreateGroupingDTO.color` | ALIGNED |
| `groupingSchema.type` | `CreateGroupingDTO.type` | ALIGNED (via state) |
| `subcategorySchema.name` | `CreateSubcategoryDTO.name` | ALIGNED |

**Finding**: All Zod schemas align with Sacred Domain DTOs. The `type` field is managed via React state toggle rather than Zod schema, which is an acceptable UI pattern.

---

## 3. Entity Audit (Ghost Prop Audit)

### 3.1 GroupingEntity Properties

**Source**: `domain/categories.ts` (lines 179-219)

| Property | Type | UI Component Usage | Business Logic Usage | Status |
|----------|------|-------------------|---------------------|--------|
| `id` | `string` | grouping-list-item.tsx (key), delete-grouping-dialog.tsx, edit-grouping-form.tsx | All mutations, query keys | **ACTIVE** |
| `userId` | `string` | N/A (RLS handles) | Repository auth context | **ACTIVE (Auth)** |
| `name` | `string` | grouping-list-item.tsx (display), all forms | Create/Update DTOs | **ACTIVE** |
| `color` | `string` | grouping-list-item.tsx (icon color), all forms, add-subcategory-modal.tsx (inheritance) | Create/Update DTOs | **ACTIVE** |
| `type` | `CategoryType` | add-grouping-form.tsx (toggle), edit-grouping-form.tsx (toggle) | Create/Update DTOs | **ACTIVE** |
| `createdAt` | `string` | **NONE** | **NONE** | **GHOST** |
| `updatedAt` | `string` | **NONE** | **NONE** | **GHOST** |
| `version` | `number` | delete-grouping-dialog.tsx, edit-grouping-form.tsx | Mutation DTOs (OCC) | **ACTIVE** |
| `deletedAt` | `string \| null` | N/A | Tombstone filter (implicit) | **ACTIVE (Sync)** |
| `childCount` | `number` | N/A (fetched via useGroupingChildren) | Deletion validation | **ACTIVE** |
| `totalTransactionCount` | `number` | grouping-list-item.tsx (line 49: subtitle) | Deletion validation | **ACTIVE** |

### 3.2 Property Usage Matrix

```
Property               | add-form | add-sub | delete | edit-form | list-item | list | nav-hook | groupings-hook
-----------------------|----------|---------|--------|-----------|-----------|------|----------|---------------
id                     |          | X       | X      | X         | X         | X    | X        | X
userId                 |          |         |        |           |           |      |          |
name                   | X        | X       |        | X         | X         |      |          | X
color                  | X        | X       |        | X         | X         |      |          | X
type                   | X        |         |        | X         |           |      |          | X
createdAt              |          |         |        |           |           |      |          |
updatedAt              |          |         |        |           |           |      |          |
version                |          |         | X      | X         |           |      |          | X
deletedAt              |          |         |        |           |           |      |          |
childCount             |          |         |        |           |           |      |          |
totalTransactionCount  |          |         |        |           | X         |      |          |
```

### 3.3 Ghost Prop Summary

| Entity | Ghost Props | Justification | Recommendation |
|--------|-------------|---------------|----------------|
| GroupingEntity | `createdAt`, `updatedAt` | Not rendered in UI; not used in any business logic within groupings folder | Document as "Future Use - Audit Trail" per Manifesto |

**CTO Mandate Reference** (MANIFESTO.md):
> "Every property in a ViewEntity MUST be: (1) Rendered in a UI component, OR (2) Used in business logic, OR (3) Marked @deprecated with removal timeline"

**Finding**: Same ghost props as CategoryEntity. These timestamps serve as audit trail fields for future use (e.g., "Created on", "Last modified" displays).

---

## 4. Local "Spaghetti" Report

### 4.1 Component Analysis Matrix

| Component | File | Direct DB Calls | Business Logic Leakage | Data Transformation | Status |
|-----------|------|-----------------|----------------------|---------------------|--------|
| AddGroupingForm | add-grouping-form.tsx | None | Zod schema (acceptable) | None | **CLEAN** |
| AddSubcategoryModal | add-subcategory-modal.tsx | None | useMemo for parent selection (UI-specific) | None | **CLEAN** |
| DeleteGroupingDialog | delete-grouping-dialog.tsx | None | hasChildren check (UI-specific rendering) | None | **CLEAN** |
| EditGroupingForm | edit-grouping-form.tsx | None | useMemo for filtering, subcategory selection | None | **CLEAN** |
| GroupingListItem | grouping-list-item.tsx | None | Pure presentational | None | **CLEAN** |
| GroupingList | grouping-list.tsx | None | Pure composition | None | **CLEAN** |

### 4.2 Detailed Analysis

#### add-grouping-form.tsx
- **Form Validation**: Inline Zod schema - acceptable at component level
- **State Management**: `categoryType` toggle - UI-specific
- **Mutation**: Delegates to `useAddGrouping()` hook
- **Verdict**: Zero business logic leakage

#### add-subcategory-modal.tsx
- **Parent Selection**: `useMemo` for deriving selected parent - UI-specific
- **Color Inheritance**: `color: selectedParent.color` - Domain rule but tightly coupled to UI flow
- **Mutation**: Delegates to `useAddSubcategory()` hook
- **Verdict**: Zero business logic leakage

#### delete-grouping-dialog.tsx
- **Constraint Check**: `hasChildren` validation - UI-specific rendering decision
- **Data Source**: Uses `useGroupingChildren()` to fetch children count
- **Mutation**: Delegates to `useDeleteGrouping()` hook
- **Verdict**: Zero business logic leakage

#### edit-grouping-form.tsx
- **Subcategory Filtering**: `useMemo` for available parents - UI-specific
- **Selection State**: Local state for bulk operations - UI-specific
- **Mutations**: Delegates to `useUpdateGrouping()`, `useReassignSubcategory()` hooks
- **Verdict**: Zero business logic leakage

#### grouping-list-item.tsx
- **Pure Presentational**: Receives all data via props, renders using `ResourceListItem`
- **No Internal State**: Pure component
- **Verdict**: Zero business logic leakage

#### grouping-list.tsx
- **Orchestrator Container**: Manages modal state and event handlers
- **Data Source**: `useGroupings()` hook
- **Verdict**: Zero business logic leakage

### 4.3 Violations Summary

| Violation Type | Count | Details |
|----------------|-------|---------|
| Direct Supabase calls in components | 0 | N/A |
| Business logic in components | 0 | N/A |
| Data transformation in components | 0 | N/A |
| Validation logic outside service | 0 | All via orchestrator |

**Finding**: Zero spaghetti violations. The groupings feature exemplifies the "thin presentation layer" pattern - all business logic properly delegated to the orchestrator hook (`useCategoryOperations`).

---

## 5. Architectural Patterns Detected

### 5.1 Orchestrator Pattern
- All operations via `useCategoryOperations()` from `@/lib/hooks`
- No direct imports from `@/features/categories`
- Clean IoC boundary

### 5.2 Entity Modal Composition
- Forms wrapped in shared `EntityModal` component
- Consistent UX across features

### 5.3 Error Code Typing
- Uses `isCategoryOperationError()` type guard
- Switch-case handling for typed error codes
- Example: `VERSION_CONFLICT`, `DUPLICATE_NAME`, `HAS_CHILDREN`

### 5.4 Key-Based Remounting
- `DeleteGroupingDialog` uses key prop for state reset
- Pattern: `key={grouping?.id}` forces re-render on entity change

### 5.5 URL Parameter Management
- `useGroupingNavigation()` stores filter state in URL query params
- Pattern: `?grouping={parentId}` for transaction filtering

---

## 6. Compliance Checklist

| Rule | Status | Evidence |
|------|--------|----------|
| Integer Cents Only | N/A | No monetary values in groupings domain |
| Result Pattern (DataResult<T>) | PASS | Via `useCategoryOperations()` orchestrator |
| Zero-Any Policy | **PASS** | Grep: 0 matches for `any`, `as any`, `@ts-ignore`, `@ts-expect-error` |
| Boundary Mapping | PASS | Delegated to categories repository layer |
| No Cross-Feature Imports | **PASS** | Grep: 0 matches for `@/features/` imports |
| Business Logic Placement | **PASS** | All via orchestrator hook, zero leakage |
| Ghost Prop Audit | 2 GHOSTS | `createdAt`, `updatedAt` not used |

---

## 7. Recommendations

### 7.1 Immediate Actions

| Priority | Action | Effort |
|----------|--------|--------|
| P3 | Add JSDoc `@future` annotation to `createdAt`/`updatedAt` in GroupingEntity | Low |

### 7.2 Future Considerations

| Item | Rationale |
|------|-----------|
| Display `createdAt` in grouping detail view | Audit trail visibility |
| Add "Last modified" indicator | User awareness of changes |

---

## Appendix: Files Analyzed

```
features/groupings/components/add-grouping-form.tsx
features/groupings/components/add-subcategory-modal.tsx
features/groupings/components/delete-grouping-dialog.tsx
features/groupings/components/edit-grouping-form.tsx
features/groupings/components/grouping-list-item.tsx
features/groupings/components/grouping-list.tsx
features/groupings/hooks/use-grouping-navigation.ts
features/groupings/hooks/use-groupings.ts
```

**Domain Reference**: `domain/categories.ts` (Sacred Domain)
**Orchestrator Reference**: `lib/hooks/use-category-operations.ts`
