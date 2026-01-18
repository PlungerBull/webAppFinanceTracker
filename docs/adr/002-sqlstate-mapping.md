# ADR 002: SQLSTATE to Domain Error Mapping

## Status

Accepted

## Date

2026-01-17

## Context

Supabase/PostgreSQL returns errors with SQLSTATE codes that are cryptic and not
user-friendly. Our repository layer must translate these into typed domain errors
for proper error handling in the UI.

Current challenges:
1. String-matching on error messages is fragile and locale-dependent
2. UI cannot provide meaningful feedback without typed errors
3. Inconsistent error handling across features

## Decision

**The repository layer maps SQLSTATE codes to typed domain errors. UI uses
`instanceof` checks for type-safe error handling.**

### SQLSTATE Mapping Table

| SQLSTATE | PostgreSQL Error | Domain Error | UI Message Example |
|----------|-----------------|--------------|-------------------|
| `23503` | foreign_key_violation | `CategoryHasTransactionsError` | "This category has transactions. Move or delete them first." |
| `23503` | foreign_key_violation (self-ref) | `CategoryHasChildrenError` | "Delete or move subcategories first." |
| `23503` | foreign_key_violation | `AccountLockedError` | "Account has linked transactions." |
| `23505` | unique_violation | `CategoryDuplicateNameError` | "A category with this name already exists." |
| `P0001` | raise_exception (trigger) | `CategoryHierarchyError` | Parsed from trigger message |
| `PGRST116` | No rows returned | `CategoryNotFoundError` | "Category not found." |

### Repository Implementation Pattern

Located in `features/categories/repository/supabase-category-repository.ts:127-187`:

```typescript
private mapDatabaseError(
  error: PostgrestError,
  context: { categoryId?: string; categoryName?: string; parentId?: string | null }
): CategoryError {
  const code = error.code || '';
  const message = error.message.toLowerCase();

  switch (code) {
    // Foreign key violation
    case '23503':
      if (message.includes('transactions')) {
        return new CategoryHasTransactionsError(context.categoryId ?? 'unknown');
      }
      if (message.includes('parent_id')) {
        return new CategoryHasChildrenError(context.categoryId ?? 'unknown');
      }
      return new CategoryRepositoryError(error.message, error);

    // Unique constraint violation
    case '23505':
      return new CategoryDuplicateNameError(
        context.categoryName ?? 'unknown',
        context.parentId ?? null
      );

    // Database trigger raised exception
    case 'P0001':
      return this.parseHierarchyError(message);

    // No rows returned (Supabase-specific)
    case 'PGRST116':
      return new CategoryNotFoundError(context.categoryId ?? 'unknown');

    default:
      return new CategoryRepositoryError(error.message, error);
  }
}

private parseHierarchyError(message: string): CategoryHierarchyError {
  if (message.includes('own parent')) {
    return new CategoryHierarchyError('self_parent');
  }
  if (message.includes('max') || message.includes('depth')) {
    return new CategoryHierarchyError('max_depth');
  }
  if (message.includes('child') && message.includes('parent')) {
    return new CategoryHierarchyError('parent_is_child');
  }
  return new CategoryHierarchyError('self_parent'); // fallback
}
```

### UI Error Handling Pattern

Located in `features/categories/hooks/use-category-mutations.ts`:

```typescript
// CTO MANDATE: Use instanceof for type-safe error handling (NOT string matching)
onError: (err, _id, context) => {
  // Rollback optimistic update
  if (context?.previousCategories) {
    queryClient.setQueryData(QUERY_KEYS.CATEGORIES, context.previousCategories);
  }

  // Type-safe error handling via type guards
  if (isCategoryHasTransactionsError(err)) {
    toast.error('Cannot delete category', {
      description:
        err.transactionCount > 0
          ? `This category has ${err.transactionCount} transactions.`
          : 'This category has transactions. Move or delete them first.',
    });
  } else if (isCategoryHasChildrenError(err)) {
    toast.error('Cannot delete category', {
      description: 'This category has subcategories. Delete or move them first.',
    });
  } else if (isCategoryHierarchyError(err)) {
    const messages: Record<HierarchyViolationReason, string> = {
      self_parent: 'A category cannot be its own parent.',
      max_depth: 'Categories can only be 2 levels deep.',
      parent_is_child: 'Cannot make a subcategory the parent.',
    };
    toast.error('Invalid hierarchy', { description: messages[err.reason] });
  } else {
    toast.error('Failed to delete category', { description: err.message });
  }
}
```

### Domain Error Class Pattern

Located in `features/categories/domain/errors.ts`:

```typescript
// Base error with code
export class CategoryError extends DomainError {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

// Typed error with semantic data
export class CategoryHasTransactionsError extends CategoryError {
  constructor(
    public readonly categoryId: string,
    public readonly transactionCount: number = 0
  ) {
    super(`Category has ${transactionCount} transactions`, 'CATEGORY_HAS_TRANSACTIONS');
  }
}

// Type guard for safe narrowing
export function isCategoryHasTransactionsError(
  error: unknown
): error is CategoryHasTransactionsError {
  return error instanceof CategoryHasTransactionsError;
}
```

### Swift Mirror (for iOS Port)

```swift
enum CategoryError: Error, Codable {
    case notFound(categoryId: String)
    case validationError(message: String, field: String?)
    case repositoryError(message: String)
    case duplicateName(name: String, parentId: String?)
    case hierarchyViolation(reason: HierarchyViolationReason)
    case hasTransactions(categoryId: String, transactionCount: Int)
    case hasChildren(categoryId: String, childCount: Int)
}

enum HierarchyViolationReason: String, Codable {
    case selfParent = "self_parent"
    case maxDepth = "max_depth"
    case parentIsChild = "parent_is_child"
}
```

## Consequences

### Positive

- Type-safe error handling with `instanceof`
- Consistent, user-friendly error messages
- Cross-platform compatibility (iOS Swift mirrors these error types)
- Errors carry semantic data (e.g., `transactionCount`, `reason`)
- No string matching in UI code

### Negative

- Repository must maintain SQLSTATE mapping logic
- New database constraints require new error classes
- Testing requires mocking specific SQLSTATE codes

## Enforcement

- **Code Review**: Any PR using string matching for errors (`if (err.message.includes(...))`)
  is an automatic reject
- **Type Guards**: Always use type guard functions (`isCategoryHasTransactionsError()`)
- **Repository Boundary**: All SQLSTATE mapping happens in repository, never in service/UI

## References

- [PostgreSQL SQLSTATE Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
- [Supabase Error Handling](https://supabase.com/docs/reference/javascript/handling-errors)
- [TypeScript Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
