# Composable Manifest: features/groupings

> **Generated**: 2026-01-31
> **Auditor**: Senior Systems Architect & Security Auditor
> **Scope**: `/features/groupings/` folder

---

## Executive Summary

| Category | Status | Score | Critical Issues |
|----------|--------|-------|-----------------|
| Variable & Entity Registry | PASS | 10/10 | None |
| Dependency Manifest | **FAIL** | 4/10 | 6 feature bleed violations |
| Sacred Mandate Compliance | PASS | 10/10 | None |
| Performance & Scalability | PASS | 10/10 | None |

**Overall Score: 8.5/10** - Feature bleed violations must be resolved.

### Critical Issues Found

| Violation | File | Line | Import |
|-----------|------|------|--------|
| Feature Bleed | `add-subcategory-modal.tsx` | 17 | `@/features/categories/domain` |
| Feature Bleed | `delete-grouping-dialog.tsx` | 7 | `@/features/categories/domain` |
| Feature Bleed | `grouping-list-item.tsx` | 6 | `@/features/categories/domain` |
| Feature Bleed | `grouping-list.tsx` | 6 | `@/features/categories/components` |
| Feature Bleed | `grouping-list.tsx` | 7 | `@/features/categories/components` |
| Feature Bleed | `grouping-list.tsx` | 18 | `@/features/categories/domain` |

**Required Fix**: Replace all `@/features/categories/domain` imports with `@/domain/categories`.

---

## 1. Variable & Entity Registry

### 1.1 Feature File Inventory

**Total Files**: 6 | **Total Lines**: 1,029

#### features/groupings/components/

| File | Lines | Purpose |
|------|-------|---------|
| `add-subcategory-modal.tsx` | 234 | Modal for creating subcategories under a parent grouping |
| `delete-grouping-dialog.tsx` | 102 | Confirmation dialog for deleting groupings |
| `grouping-list-item.tsx` | 55 | Individual grouping row with actions |
| `grouping-list.tsx` | 115 | Main list component with modal coordination |

#### features/groupings/hooks/

| File | Lines | Purpose |
|------|-------|---------|
| `use-groupings.ts` | 439 | React Query hooks for CRUD operations |
| `use-grouping-navigation.ts` | 84 | URL parameter management for filtering |

### 1.2 Entity Inventory

#### Imported from Sacred Domain (`@/domain/categories`)

| Entity | Kind | Used In | Description |
|--------|------|---------|-------------|
| `GroupingEntity` | interface | All files | Parent category with counts |
| `CategoryWithCountEntity` | interface | `use-groupings.ts` | Child category with transaction count |
| `CreateGroupingDTO` | interface | `use-groupings.ts` | Create parent DTO |
| `CreateSubcategoryDTO` | interface | `use-groupings.ts` | Create child DTO |
| `UpdateGroupingDTO` | interface | `use-groupings.ts` | Update parent DTO |
| `ReassignSubcategoryDTO` | interface | `use-groupings.ts` | Move subcategory DTO |
| `CategoryOperationError` | interface | `use-groupings.ts` | Typed error with code |
| `isCategoryOperationError` | type guard | `use-groupings.ts` | Error type checking |

#### Locally Defined Interfaces

| Name | Kind | File | Line |
|------|------|------|------|
| `AddSubcategoryModalProps` | interface | `add-subcategory-modal.tsx` | 19-23 |
| `SubcategoryFormData` | type (Zod infer) | `add-subcategory-modal.tsx` | 30 |
| `DeleteGroupingDialogProps` | interface | `delete-grouping-dialog.tsx` | 9-13 |
| `GroupingListItemProps` | interface | `grouping-list-item.tsx` | 8-15 |
| `UseGroupingNavigationReturn` | type | `use-grouping-navigation.ts` | 79-84 |

### 1.3 Naming Audit

| Convention | Status | Evidence |
|------------|--------|----------|
| Domain objects: **camelCase** | ✅ PASS | `groupingId`, `parentId`, `childCount`, `totalTransactionCount` |
| Database rows: **snake_case** | ✅ PASS | Via `@/lib/data/data-transformers.ts` |
| Error codes: **SCREAMING_SNAKE_CASE** | ✅ PASS | `VERSION_CONFLICT`, `HAS_CHILDREN`, `DUPLICATE_NAME` |
| Props interfaces: **PascalCase + Props** | ✅ PASS | `GroupingListItemProps`, `DeleteGroupingDialogProps` |
| Hooks: **use + camelCase** | ✅ PASS | `useGroupings`, `useGroupingNavigation` |

### 1.4 Type Safety

| Check | Status | Count | Details |
|-------|--------|-------|---------|
| `any` usage | ✅ PASS | 0 | Verified via grep |
| `unknown` usage | ✅ PASS | 0 | Verified via grep |
| `as any` assertions | ✅ PASS | 0 | No type bypass |
| `as unknown` assertions | ✅ PASS | 0 | No type bypass |
| `z.any()` usage | ✅ PASS | 0 | No Zod bypass |
| `z.unknown()` usage | ✅ PASS | 0 | No Zod bypass |
| Zod validation | ✅ PASS | 1 | `subcategorySchema` in `add-subcategory-modal.tsx:26-28` |

**Zod Schema Definition:**
```typescript
// add-subcategory-modal.tsx:26-28
const subcategorySchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, GROUPING.UI.MESSAGES.SUBCATEGORY_NAME_REQUIRED),
});

type SubcategoryFormData = z.infer<typeof subcategorySchema>;
```

---

## 2. Dependency Manifest

### 2.1 Feature Bleed Check

**Status: FAIL** - 6 violations detected

#### Violations Detail

| File | Line | Violating Import | Should Be |
|------|------|------------------|-----------|
| `add-subcategory-modal.tsx` | 17 | `import type { GroupingEntity } from '@/features/categories/domain'` | `@/domain/categories` |
| `delete-grouping-dialog.tsx` | 7 | `import type { GroupingEntity } from '@/features/categories/domain'` | `@/domain/categories` |
| `grouping-list-item.tsx` | 6 | `import type { GroupingEntity } from '@/features/categories/domain'` | `@/domain/categories` |
| `grouping-list.tsx` | 6 | `import { AddCategoryModal } from '@/features/categories/components/add-category-modal'` | Move to shared or expose via lib |
| `grouping-list.tsx` | 7 | `import { EditGroupingModal } from '@/features/categories/components/edit-grouping-modal'` | Move to shared or expose via lib |
| `grouping-list.tsx` | 18 | `import type { GroupingEntity } from '@/features/categories/domain'` | `@/domain/categories` |

#### Compliant Imports (use-groupings.ts)

```typescript
// CORRECT: Sacred Domain imports
import type {
  CreateGroupingDTO,
  CreateSubcategoryDTO,
  UpdateGroupingDTO,
  ReassignSubcategoryDTO,
  GroupingEntity,
  CategoryWithCountEntity,
} from '@/domain/categories';
import { isCategoryOperationError } from '@/domain/categories';

// CORRECT: IoC orchestrator hook
import { useCategoryOperations } from '@/lib/hooks/use-category-operations';
```

### 2.2 Import Analysis by File

#### use-groupings.ts ✅ COMPLIANT

| Import | Source | Status |
|--------|--------|--------|
| Types (DTOs, Entities) | `@/domain/categories` | ✅ Sacred Domain |
| `isCategoryOperationError` | `@/domain/categories` | ✅ Sacred Domain |
| `useCategoryOperations` | `@/lib/hooks/use-category-operations` | ✅ IoC Pattern |
| React Query hooks | `@tanstack/react-query` | ✅ External |
| `toast` | `sonner` | ✅ External |
| Constants | `@/lib/constants` | ✅ Shared lib |

#### use-grouping-navigation.ts ✅ COMPLIANT

| Import | Source | Status |
|--------|--------|--------|
| `useCallback` | `react` | ✅ External |
| `useRouter`, `useSearchParams` | `next/navigation` | ✅ External |

#### add-subcategory-modal.tsx ❌ VIOLATION

| Import | Source | Status |
|--------|--------|--------|
| `GroupingEntity` | `@/features/categories/domain` | ❌ Feature bleed |
| Other imports | Various shared/UI | ✅ OK |

#### delete-grouping-dialog.tsx ❌ VIOLATION

| Import | Source | Status |
|--------|--------|--------|
| `GroupingEntity` | `@/features/categories/domain` | ❌ Feature bleed |
| Other imports | Various shared/UI | ✅ OK |

#### grouping-list-item.tsx ❌ VIOLATION

| Import | Source | Status |
|--------|--------|--------|
| `GroupingEntity` | `@/features/categories/domain` | ❌ Feature bleed |
| Other imports | Various shared/UI | ✅ OK |

#### grouping-list.tsx ❌ 3 VIOLATIONS

| Import | Source | Status |
|--------|--------|--------|
| `AddCategoryModal` | `@/features/categories/components` | ❌ Feature bleed |
| `EditGroupingModal` | `@/features/categories/components` | ❌ Feature bleed |
| `GroupingEntity` | `@/features/categories/domain` | ❌ Feature bleed |
| Other imports | Various shared/UI | ✅ OK |

### 2.3 Transformer Usage

| Check | Status | Evidence |
|-------|--------|----------|
| Uses centralized transformers | ✅ PASS | Via `useCategoryOperations` → `CategoryService` → `data-transformers.ts` |
| Inline DB → Domain mapping | ✅ NONE | No `.map()` with inline snake_case conversion |
| Transformer function | ✅ USED | `dbParentCategoryWithCountToDomain()` in service layer |

**Data Flow:**
```
Database (snake_case)
  ↓ HybridCategoryRepository
  ↓ dbParentCategoryWithCountToDomain()
  ↓ ICategoryOperations.getGroupings()
  ↓ withErrorMapping() (error translation)
  ↓ useGroupings() hook
  ↓ GroupingEntity (camelCase)
  ↓ Component
```

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

| Status | ✅ PASS (N/A) |
|--------|---------------|

**Finding**: This feature handles metadata only (names, colors, hierarchy). No financial arithmetic is performed.

**Evidence:**
```typescript
// grouping-list-item.tsx:49 - Uses count, NOT money
subtitle={grouping.totalTransactionCount || 0}
```

### 3.2 Sync Integrity

| Status | ✅ PASS |
|--------|---------|

| Check | Status | Evidence |
|-------|--------|----------|
| Version parameter in mutations | ✅ | `useDeleteGrouping`, `useUpdateGrouping` |
| Orchestrator Rule compliance | ✅ | `enabled: !!operations` on all queries |
| Error code handling | ✅ | `VERSION_CONFLICT` case in error handlers |

**Evidence - Version in Delete:**
```typescript
// use-groupings.ts:255-259
mutationFn: ({ id, version }: { id: string; version: number }) => {
  if (!operations) {
    throw new Error('Grouping operations not ready');
  }
  return operations.delete(id, version);
}

// delete-grouping-dialog.tsx:36
await deleteGroupingMutation.mutateAsync({ id: grouping.id, version: grouping.version });
```

**Evidence - Version Conflict Handling:**
```typescript
// use-groupings.ts:278-281
case 'VERSION_CONFLICT':
  toast.error('Conflict detected', {
    description: 'This grouping was modified elsewhere. Please refresh and try again.',
  });
  break;
```

### 3.3 Soft Deletes

| Status | ✅ PASS |
|--------|---------|

| Check | Status | Evidence |
|-------|--------|----------|
| Physical DELETE statements | ✅ 0 found | Grep verified |
| Tombstone pattern used | ✅ | Via `delete_category_with_version` RPC |
| `deletedAt` field | ✅ | Present in `GroupingEntity` interface |

### 3.4 Auth Abstraction

| Status | ✅ PASS |
|--------|---------|

| Check | Status | Evidence |
|-------|--------|----------|
| Direct `supabase.auth.getUser()` | ✅ 0 found | Grep verified |
| Direct `supabase.auth.getSession()` | ✅ 0 found | Grep verified |
| IAuthProvider usage | ✅ | Via CategoryService DI chain |

**Auth Provider Chain:**
```
useGroupings()
  → useCategoryOperations()
  → useCategoryService()
  → createSupabaseAuthProvider(supabase)
  → IAuthProvider.getCurrentUserId()
```

---

## 4. Performance & Scalability

### 4.1 React Compiler Check

| Status | ✅ PASS |
|--------|---------|

| Check | Status | Count |
|-------|--------|-------|
| `watch()` from react-hook-form | ✅ | 0 found |
| `useWatch` usage | ✅ | 1 (correct) |

**Evidence:**
```typescript
// add-subcategory-modal.tsx:70-74
const subcategoryName = useWatch({
    control,
    name: 'name',
    defaultValue: '',
});
```

### 4.2 Re-render Optimization

| Pattern | File | Line | Status | Dependencies |
|---------|------|------|--------|--------------|
| `useMemo` | `add-subcategory-modal.tsx` | 40-42 | ✅ Correct | `[manualParentSelection, parentGrouping]` |
| `useMemo` | `use-category-operations.ts` | 182-211 | ✅ Correct | `[service]` |
| `useCallback` | `use-grouping-navigation.ts` | 29-49 | ✅ Correct | `[router, searchParams, currentGroupingId]` |
| `useCallback` | `use-grouping-navigation.ts` | 54-58 | ✅ Correct | `[router, searchParams]` |
| `useCallback` | `use-grouping-navigation.ts` | 63-66 | ✅ Correct | `[currentGroupingId]` |
| `useEffect` | All components | - | ✅ None | Clean state management |

**useMemo Example:**
```typescript
// add-subcategory-modal.tsx:40-42
const selectedParent = useMemo(() => {
    return manualParentSelection ?? parentGrouping;
}, [manualParentSelection, parentGrouping]);
```

### 4.3 Query Configuration

| Configuration | Status | Evidence |
|---------------|--------|----------|
| `staleTime` | ✅ | `QUERY_CONFIG.STALE_TIME.MEDIUM` |
| `enabled` guard | ✅ | `!!operations` on all queries |
| Query invalidation | ✅ | On all mutation success handlers |
| `isReady` flag | ✅ | Exposed on all mutation hooks |

**Query Example:**
```typescript
// use-groupings.ts:64-75
return useQuery({
  queryKey: QUERY_KEYS.GROUPINGS,
  queryFn: () => {
    if (!operations) {
      throw new Error('Grouping operations not ready');
    }
    return operations.getGroupings();
  },
  staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
  enabled: !!operations, // CTO MANDATE: Orchestrator Rule
});
```

### 4.4 Component Patterns

| Pattern | File | Status | Notes |
|---------|------|--------|-------|
| Key-based remount | `delete-grouping-dialog.tsx:94-100` | ✅ | Resets inner state when grouping changes |
| Actions array | `grouping-list-item.tsx:25-42` | ⚠️ | Recreated per render (acceptable) |
| Form hooks | `add-subcategory-modal.tsx` | ✅ | `useFormModal` abstraction |

---

## 5. Architectural Analysis

### 5.1 ICategoryOperations IoC Pattern

The feature correctly uses the IoC pattern via `useCategoryOperations`:

```typescript
// use-groupings.ts:62
const operations = useCategoryOperations();
```

This decouples from the concrete `CategoryService` and uses the Sacred Domain interface.

### 5.2 Error Translation Layer

Errors are translated in `use-category-operations.ts`:

```
CategoryHasChildrenError → { code: 'HAS_CHILDREN', childCount: N }
CategoryVersionConflictError → { code: 'VERSION_CONFLICT' }
CategoryDuplicateNameError → { code: 'DUPLICATE_NAME' }
CategoryHierarchyError → { code: 'INVALID_HIERARCHY' }
CategoryHasTransactionsError → { code: 'HAS_TRANSACTIONS' }
CategoryNotFoundError → { code: 'NOT_FOUND' }
```

### 5.3 Hooks Exported

| Hook | Queries/Mutations | isReady |
|------|-------------------|---------|
| `useGroupings` | Query | N/A (uses enabled) |
| `useGroupingChildren` | Query | N/A (uses enabled) |
| `useAddGrouping` | Mutation | ✅ |
| `useUpdateGrouping` | Mutation | ✅ |
| `useDeleteGrouping` | Mutation | ✅ |
| `useAddSubcategory` | Mutation | ✅ |
| `useReassignSubcategory` | Mutation | ✅ |
| `useGroupingNavigation` | Navigation | N/A |

---

## 6. Recommendations

### 6.1 Critical: Fix Feature Bleed (6 violations)

**Priority: HIGH**

Replace all `@/features/categories/domain` imports with `@/domain/categories`:

```typescript
// BEFORE (all 4 component files)
import type { GroupingEntity } from '@/features/categories/domain';

// AFTER
import type { GroupingEntity } from '@/domain/categories';
```

For modal components (`AddCategoryModal`, `EditGroupingModal`), choose one approach:
1. Move modals to `@/components/shared/category-modals/`
2. Create `@/lib/hooks/use-category-modals` that exposes them via IoC

### 6.2 Optional: Actions Array Memoization

**Priority: LOW**

In `grouping-list-item.tsx`, the `actions` array is recreated on every render:

```typescript
// Current - recreates array per render
const actions = [
  { label: '...', icon: Pencil, onClick: () => onEdit(grouping) },
  // ...
];
```

If performance profiling shows issues, memoize with `useMemo`.

### 6.3 Optional: List Virtualization

**Priority: LOW**

If groupings list exceeds 100+ items in production, consider:
- `react-window` or `@tanstack/react-virtual`
- `React.memo()` for `GroupingListItem`

---

## 7. Score Card

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Variable & Entity Registry | 10/10 | 25% | 2.50 |
| Dependency Manifest | 4/10 | 25% | 1.00 |
| Sacred Mandate Compliance | 10/10 | 30% | 3.00 |
| Performance & Scalability | 10/10 | 20% | 2.00 |
| **Total** | | | **8.50/10** |

---

## Appendix A: Complete Import Map

### use-groupings.ts
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants';
import { useCategoryOperations } from '@/lib/hooks/use-category-operations';
import type {
  CreateGroupingDTO,
  CreateSubcategoryDTO,
  UpdateGroupingDTO,
  ReassignSubcategoryDTO,
  GroupingEntity,
  CategoryWithCountEntity,
} from '@/domain/categories';
import { isCategoryOperationError } from '@/domain/categories';
```

### use-grouping-navigation.ts
```typescript
import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
```

### add-subcategory-modal.tsx
```typescript
import { useState, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { useFormModal } from '@/lib/hooks/use-form-modal';
import { z } from 'zod';
import { useAddSubcategory, useGroupings } from '../hooks/use-groupings';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Check, X, Pencil } from 'lucide-react';
import { VALIDATION, GROUPING } from '@/lib/constants';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { GroupingEntity } from '@/features/categories/domain'; // ❌ VIOLATION
```

### delete-grouping-dialog.tsx
```typescript
import { useState } from 'react';
import { useDeleteGrouping, useGroupingChildren } from '../hooks/use-groupings';
import { DeleteDialog } from '@/components/shared/delete-dialog';
import { GROUPING } from '@/lib/constants';
import type { GroupingEntity } from '@/features/categories/domain'; // ❌ VIOLATION
```

### grouping-list-item.tsx
```typescript
import { Pencil, Trash2, Plus, Archive } from 'lucide-react';
import { ResourceListItem } from '@/components/ui/resource-list-item';
import { GROUPING } from '@/lib/constants';
import type { GroupingEntity } from '@/features/categories/domain'; // ❌ VIOLATION
```

### grouping-list.tsx
```typescript
import { useState } from 'react';
import { useGroupings } from '../hooks/use-groupings';
import { useGroupingNavigation } from '../hooks/use-grouping-navigation';
import { AddCategoryModal } from '@/features/categories/components/add-category-modal'; // ❌ VIOLATION
import { EditGroupingModal } from '@/features/categories/components/edit-grouping-modal'; // ❌ VIOLATION
import { DeleteGroupingDialog } from './delete-grouping-dialog';
import { AddSubcategoryModal } from './add-subcategory-modal';
import { Button } from '@/components/ui/button';
import { GroupingListItem } from './grouping-list-item';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { GROUPING } from '@/lib/constants';
import type { GroupingEntity } from '@/features/categories/domain'; // ❌ VIOLATION
```

---

## Appendix B: Error Code Reference

| Code | Trigger | User Message | Recovery |
|------|---------|--------------|----------|
| `VERSION_CONFLICT` | Concurrent edit | "Modified elsewhere. Refresh." | Refetch + retry |
| `DUPLICATE_NAME` | Name exists | "Already exists" | Choose new name |
| `HAS_CHILDREN` | Delete blocked | "Has N subcategories" | Move children first |
| `HAS_TRANSACTIONS` | Delete blocked | "Has transactions" | Move txns first |
| `INVALID_HIERARCHY` | Bad parent | "Invalid hierarchy" | Choose valid parent |
| `NOT_FOUND` | Missing entity | "Not found" | Refetch list |
| `SERVICE_NOT_READY` | Orchestrator null | (Internal) | Wait for ready |

---

*Generated by Technical Audit System | 2026-01-31*
