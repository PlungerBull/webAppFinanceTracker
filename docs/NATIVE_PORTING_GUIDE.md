# Native Porting Guide (iOS/Swift)

> **Purpose:** Contract between TypeScript domain and Swift Codable structs. Every property listed here is actively used in UI/business logic. Properties not in this guide should NOT be implemented in Swift.

---

## Sacred Boundary Contract

**Rule:** Every property in a ViewEntity must be:
1. Rendered in a UI component, OR
2. Used in business logic, OR
3. Explicitly marked `@deprecated` with removal timeline

Properties that exist "just in case" violate the Bridge Saturation mandate and increase JSON parsing latency on the native bridge.

---

## Entity Registry

### TransactionViewEntity

**Source:** `features/transactions/domain/entities.ts`

| Property | Type | UI Usage | Swift Type |
|----------|------|----------|------------|
| `id` | string | Row key, navigation | `String` |
| `version` | number | Optimistic concurrency | `Int` |
| `userId` | string | Auth guard | `String` |
| `amountCents` | number | Display (formatted) | `Int` |
| `amountHomeCents` | number | Multi-currency totals | `Int` |
| `currencyOriginal` | string? | Currency display | `String?` |
| `exchangeRate` | number | Conversion display | `Decimal` |
| `accountId` | string | Account filter | `String` |
| `categoryId` | string? | Category filter | `String?` |
| `transferId` | string? | Transfer pairing | `String?` |
| `description` | string? | List display | `String?` |
| `notes` | string? | Detail panel | `String?` |
| `date` | string | Sort, display | `String` (ISO 8601) |
| `createdAt` | string | Audit | `String` |
| `updatedAt` | string | Sync | `String` |
| `deletedAt` | string? | Tombstone pattern | `String?` |
| `reconciliationId` | string? | Reconciliation filter | `String?` |
| `cleared` | boolean | Reconciliation badge | `Bool` |
| `accountName` | string? | List display | `String?` |
| `accountColor` | string? | Color indicator | `String?` |
| `categoryName` | string? | List display | `String?` |
| `categoryColor` | string? | Color chip | `String?` |
| `categoryType` | enum? | Income/expense styling | `String?` |
| `reconciliationStatus` | enum? | Status badge | `String?` |

**EXCLUDED (Ghost Props):**
- ~~`accountCurrency`~~ - Redundant with `currencyOriginal`. Remove in Phase 1.1.

**Swift Codable Struct:**
```swift
struct TransactionViewEntity: Codable, Identifiable {
    let id: String
    let version: Int
    let userId: String
    let amountCents: Int
    let amountHomeCents: Int
    let currencyOriginal: String?
    let exchangeRate: Decimal
    let accountId: String
    let categoryId: String?
    let transferId: String?
    let description: String?
    let notes: String?
    let date: String
    let createdAt: String
    let updatedAt: String
    let deletedAt: String?
    let reconciliationId: String?
    let cleared: Bool

    // Joined fields
    let accountName: String?
    let accountColor: String?
    let categoryName: String?
    let categoryColor: String?
    let categoryType: String?
    let reconciliationStatus: String?
}
```

---

### AccountViewEntity

**Source:** `domain/accounts.ts`

| Property | Type | UI Usage | Swift Type |
|----------|------|----------|------------|
| `id` | string | Row key | `String` |
| `version` | number | Optimistic concurrency | `Int` |
| `userId` | string | Auth guard | `String` |
| `groupId` | string | Account grouping | `String` |
| `name` | string | Display | `String` |
| `type` | AccountType | Icon selection | `String` |
| `currencyCode` | string | Currency display | `String` |
| `color` | string | Color indicator | `String` |
| `currentBalanceCents` | number | Balance display | `Int` |
| `isVisible` | boolean | Visibility toggle | `Bool` |
| `createdAt` | string | Audit | `String` |
| `updatedAt` | string | Sync | `String` |
| `deletedAt` | string? | Tombstone pattern | `String?` |
| `currencySymbol` | string? | Balance formatting | `String?` |

**Swift Codable Struct:**
```swift
struct AccountViewEntity: Codable, Identifiable {
    let id: String
    let version: Int
    let userId: String
    let groupId: String
    let name: String
    let type: String
    let currencyCode: String
    let color: String
    let currentBalanceCents: Int
    let isVisible: Bool
    let createdAt: String
    let updatedAt: String
    let deletedAt: String?
    let currencySymbol: String?
}
```

---

### CategoryEntity / GroupingEntity

**Source:** `domain/categories.ts`

| Property | Type | UI Usage | Swift Type |
|----------|------|----------|------------|
| `id` | string | Row key | `String` |
| `userId` | string | Auth guard | `String` |
| `name` | string | Display | `String` |
| `color` | string | Color chip | `String` |
| `type` | CategoryType | Filter tabs | `String` |
| `parentId` | string? | Hierarchy | `String?` |
| `createdAt` | string | Audit | `String` |
| `updatedAt` | string | Sync | `String` |
| `version` | number | Optimistic concurrency | `Int` |
| `deletedAt` | string? | Tombstone pattern | `String?` |

**GroupingEntity additional fields:**
| `childCount` | number | Expand indicator | `Int` |
| `totalTransactionCount` | number | Usage stats | `Int` |

**CategoryWithCountEntity additional fields:**
| `transactionCount` | number | Usage stats | `Int` |

**Swift Codable Structs:**
```swift
struct CategoryEntity: Codable, Identifiable {
    let id: String
    let userId: String
    let name: String
    let color: String
    let type: String
    let parentId: String?
    let createdAt: String
    let updatedAt: String
    let version: Int
    let deletedAt: String?
}

struct GroupingEntity: Codable, Identifiable {
    let id: String
    let userId: String
    let name: String
    let color: String
    let type: String
    let createdAt: String
    let updatedAt: String
    let version: Int
    let deletedAt: String?
    let childCount: Int
    let totalTransactionCount: Int
}

struct CategoryWithCountEntity: Codable, Identifiable {
    // ... all CategoryEntity fields
    let transactionCount: Int
}
```

---

## Result Types

### BulkUpdateResult

**Source:** `features/transactions/domain/types.ts`

| Property | Type | UI Usage | Swift Type |
|----------|------|----------|------------|
| `successCount` | number | Toast message | `Int` |
| `failureCount` | number | Toast message | `Int` |

**EXCLUDED (Ghost Props):**
- ~~`successIds`~~ - Never accessed in UI. Remove in Phase 1.2.
- ~~`failures`~~ - Never accessed in UI. Remove in Phase 1.2.

**Swift Codable Struct:**
```swift
struct BulkUpdateResult: Codable {
    let successCount: Int
    let failureCount: Int
}
```

---

### MergeCategoriesResult

**Source:** `features/categories/repository/category-repository.interface.ts`

| Property | Type | UI Usage | Swift Type |
|----------|------|----------|------------|
| `affectedTransactionCount` | number | Toast message | `Int` |
| `mergedCategoryCount` | number | (Internal) | `Int` |
| `targetCategoryId` | string | (Internal) | `String` |

**Note:** Only `affectedTransactionCount` is displayed in UI toast.

---

## Sync Interface (Phase 2)

The following methods are marked `@beta` and should be implemented in a separate `ISyncRepository` in Swift:

- `getChangesSince(userId, sinceVersion)` - Delta sync
- `permanentlyDelete(userId, id)` - Admin-only hard delete

These are NOT part of the standard user-facing repository.

---

## Bridge Optimization Notes

### Query Caching (gcTime vs staleTime)

From `lib/constants/query.constants.ts`:

| Volatility | staleTime | gcTime | iOS Behavior |
|------------|-----------|--------|--------------|
| REFERENCE | 10min | 60min | Cache currency symbols, account types |
| STRUCTURAL | 5min | 30min | Cache categories, accounts |
| TRANSACTIONAL | 30sec | 15min | Frequent refetch for transactions |

**iOS Recommendation:**
- `gcTime >> staleTime` ensures instant hydration on app resume
- `refetchOnWindowFocus: false` prevents bridge saturation on app switch

---

## Audit Schedule

Semi-annual Ghost Prop Audit: **January, July**

Review all ViewEntity properties against UI component usage. Properties with zero component references should be marked `@deprecated` and removed in the following audit cycle.

---

*Last updated: 2026-02-01 | Ghost Prop Audit Phase 0*
