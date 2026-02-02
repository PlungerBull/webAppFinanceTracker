# Technical Debrief: Sync Null Foreign Key Fix

**Date:** 2026-02-02
**Issue:** `batch_upsert_accounts` and `batch_upsert_transactions` failing with NOT NULL constraint violations
**Status:** ✅ Resolved

---

## 1. Problem Statement

### Symptoms
Two sync operations were failing with database constraint violations:

```json
// batch_upsert_accounts
{
  "error_map": {
    "5f9ba9bb-a038-4c24-9d7b-8d7c51610fd2": "null value in column \"group_id\" of relation \"bank_accounts\" violates not-null constraint"
  },
  "synced_ids": [],
  "conflict_ids": []
}

// batch_upsert_transactions
{
  "error_map": {
    "1c824aab-a4ab-489c-972e-57389864db0b": "null value in column \"account_id\" of relation \"transactions\" violates not-null constraint",
    "ba333438-9500-44dd-bc8d-1b8800458d69": "null value in column \"account_id\" of relation \"transactions\" violates not-null constraint"
  },
  "synced_ids": [],
  "conflict_ids": []
}
```

### Impact
- Users unable to sync accounts with missing `group_id`
- Users unable to sync transactions with missing `account_id`
- Entire sync batches failing due to individual bad records

---

## 2. Root Cause Analysis

### 2.1 Immediate Cause: Inconsistent NULL Handling in SQL Functions

The batch upsert SQL functions had **inconsistent NULL handling** between UPDATE and INSERT paths:

| Operation | Code | NULL Handling |
|-----------|------|---------------|
| UPDATE (line 67) | `COALESCE((v_record->>'group_id')::UUID, group_id)` | ✅ Safe - falls back to existing value |
| INSERT (line 90) | `(v_record->>'group_id')::UUID` | ❌ Unsafe - NULL violates constraint |

When the Push Engine extracted data with `undefined` values, JSON serialization converted them to `null`, which then violated NOT NULL constraints on INSERT.

### 2.2 Deeper Cause: Missing Validation in Sync Pipeline

The **Pull Engine** and **Initial Hydration Service** accepted data from the server without validating required foreign keys:

```typescript
// pull-engine.ts - mapServerDataToModel()
case TABLE_NAMES.BANK_ACCOUNTS:
  model.groupId = data.group_id;  // No validation - accepts null!
```

This created a "leaky pipe" where:
1. Server sends incomplete data (legacy records or edge cases)
2. Pull Engine accepts it without validation
3. Local WatermelonDB stores records with null foreign keys
4. Push Engine tries to sync them back
5. Server rejects with constraint violation

### 2.3 Likely Failure Points Identified

| Source | Cause | Risk Level |
|--------|-------|------------|
| **Race Condition** | Account syncs before `group_id` associated in local state | Medium |
| **Import/Hydration Gap** | Legacy data or CSV imports missing `group_id` | High |
| **Ghost Objects** | WatermelonDB creates shallow objects for missing relations | Medium |

---

## 3. Architectural Decisions

### 3.1 Strategy: "Permissive Schema, Strict Ledger"

**CTO Mandate:** Different handling for accounts vs transactions:

| Entity | Field | Strategy | Rationale |
|--------|-------|----------|-----------|
| `bank_accounts` | `group_id` | **Permissive** - make nullable, self-heal | UI grouping can be generated client-side |
| `transactions` | `account_id` | **Strict** - reject, quarantine | Sacred Ledger - referential integrity required |

### 3.2 Rejected Approach: gen_random_uuid() in SQL

Initial plan proposed using `COALESCE(..., gen_random_uuid())` in the SQL INSERT. This was rejected as "D-Tier" because:
- Creates "ghost" relationships with no real meaning
- Foreign keys would point to non-existent records
- Causes frontend crashes and data corruption later

### 3.3 Approved Approach: Multi-Layer Defense

Five layers of protection implemented:

1. **Layer 1: Database Schema** - Relax constraint (safety net)
2. **Layer 2: RPC Logic** - Validate and return friendly errors
3. **Layer 3: Pull Engine** - Self-heal on data ingestion
4. **Layer 4: Push Engine** - Block invalid records before sending
5. **Layer 5: Zombie Cleanup** - Remove existing orphaned data

---

## 4. Implementation Details

### 4.1 Layer 1: Database Schema Change

**File:** `supabase/migrations/20260202010000_relax_account_grouping_constraint.sql`

```sql
ALTER TABLE bank_accounts ALTER COLUMN group_id DROP NOT NULL;
```

**Rationale:** Prevents hard 400 errors during sync. The Pull Engine will heal null values, but if an edge case slips through (e.g., phone dies mid-sync), the app won't crash.

### 4.2 Layer 2: RPC Validation Gate

**File:** `supabase/migrations/20260202010001_add_transaction_accountid_validation.sql`

Added validation before INSERT in `batch_upsert_transactions`:

```sql
-- VALIDATION GATE: account_id is required for Sacred Ledger
IF (v_record->>'account_id') IS NULL THEN
  v_error_map := v_error_map || jsonb_build_object(
    v_id::text,
    'LEGAL_REJECTION: Main ledger transactions require an account_id. Use transaction_inbox for orphaned items.'
  );
  CONTINUE;
END IF;
```

**Rationale:** Returns a friendly, actionable error message instead of a cryptic constraint violation. The batch continues processing other records (1 bad record doesn't fail 49 good ones).

### 4.3 Layer 3: Pull Engine Self-Healing

**File:** `lib/sync/pull-engine.ts`

```typescript
// Added import
import { TABLE_NAMES, SYNC_STATUS, generateEntityId } from '@/lib/local-db';

// Updated mapServerDataToModel()
case TABLE_NAMES.BANK_ACCOUNTS:
  // Self-healing: If server sends null group_id (legacy data),
  // generate one locally so the UI doesn't break
  model.groupId = data.group_id ?? generateEntityId();
```

**Also updated:** `lib/sync/initial-hydration-service.ts` with same pattern.

**Rationale:** When pulling data from the server, if `group_id` is missing, generate one locally. This ensures the UI always has a valid grouping ID without corrupting server data.

### 4.4 Layer 4: Push Engine Guardrail

**File:** `lib/sync/push-engine.ts`

#### 4.4.1 Block Invalid Records in extractRecordData()

```typescript
case TABLE_NAMES.TRANSACTIONS:
  // Guardrail: Block transactions without account_id
  if (!record.accountId) {
    console.error(
      `[PushEngine] Blocked sync for transaction ${record.id}: Missing Account ID`
    );
    return null;
  }
  return { ...baseData, account_id: record.accountId, /* ... */ };
```

#### 4.4.2 Handle Null Return and Mark as CONFLICT

```typescript
private async getUpsertPending(
  userId: string,
  tableName: SyncableTableName
): Promise<PendingRecord[]> {
  const records = await this.database.get(tableName).query(/* ... */).fetch();

  const validRecords: PendingRecord[] = [];
  const invalidRecords: Model[] = [];

  for (const record of records) {
    const raw = this.extractModelRaw(record);
    const pendingRecord = this.toPendingRecord(tableName, raw, false);

    // Guardrail: Check if extractRecordData returned null (validation failed)
    if (pendingRecord.data === null) {
      invalidRecords.push(record);
      continue;
    }

    validRecords.push(pendingRecord);
  }

  // Mark invalid records as 'conflict' to stop retry loop
  if (invalidRecords.length > 0) {
    await this.database.write(async () => {
      for (const record of invalidRecords) {
        await record.update((r) => {
          (r as any).localSyncStatus = SYNC_STATUS.CONFLICT;
        });
      }
    });
    console.warn(
      `[PushEngine] Marked ${invalidRecords.length} ${tableName} records as CONFLICT due to missing required fields`
    );
  }

  return validRecords;
}
```

**Critical Decision:** Records blocked by the Push Engine are marked as `CONFLICT` status. This:
- Prevents infinite retry loops (record won't stay in pending queue)
- Signals to user that manual resolution is needed
- Preserves data integrity without silent data loss

### 4.5 Layer 5: Zombie Cleanup

**File:** `supabase/migrations/20260202010002_zombie_cleanup_orphaned_transactions.sql`

```sql
DELETE FROM transactions WHERE account_id IS NULL;
```

**Result:** Found 0 orphaned transactions (database was clean).

---

## 5. Type System Updates

### 5.1 PendingRecord.data Now Nullable

**File:** `lib/sync/types.ts`

```typescript
export interface PendingRecord {
  // ... other fields
  /** Serialized record data for server (null if validation failed) */
  data: Record<string, unknown> | null;
}
```

### 5.2 extractRecordData Return Type

**File:** `lib/sync/push-engine.ts`

```typescript
private extractRecordData(
  tableName: SyncableTableName,
  record: Record<string, unknown>
): Record<string, unknown> | null {  // Added | null
```

---

## 6. Errors Encountered and Resolutions

### 6.1 TypeScript Error: Model Update Type Mismatch

**Error:**
```
error TS2345: Argument of type '(r: Record<string, unknown>) => void' is not assignable
to parameter of type '(_: Model) => void'.
```

**Location:** `push-engine.ts:302`

**Cause:** WatermelonDB's `record.update()` callback expects `(r: Model) => void`, not `(r: Record<string, unknown>) => void`.

**Solution:**
```typescript
await record.update((r) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (r as any).localSyncStatus = SYNC_STATUS.CONFLICT;
});
```

### 6.2 TypeScript Error: Nullable Data Access in Tests

**Error:**
```
error TS18047: 'record.data' is possibly 'null'.
```

**Location:** `lib/sync/__tests__/push-engine.test.ts:456-458`

**Cause:** Test code accessing `record.data.id` without null check after type change.

**Solution:**
```typescript
expect(record.data).not.toBeNull();
expect(record.data!.id).toBe('tx-1');
expect(record.data!.account_id).toBe('acc-1');
expect(record.data!.category_id).toBe('cat-1');
```

### 6.3 Migration Not Applied: In-Place Edit

**Issue:** Initial edit to `batch_upsert_transactions.sql` was an in-place modification to an existing migration file. `supabase db push` only applies new migration files, not re-applies modified ones.

**Solution:** Created a new migration file `20260202010001_add_transaction_accountid_validation.sql` with the updated `CREATE OR REPLACE FUNCTION` to apply the changes.

### 6.4 No Test Runner Configured

**Issue:** `npm test` failed with "Missing script: test"

**Workaround:** Verified changes via:
1. `npx tsc --noEmit` - TypeScript compilation check ✅
2. `npm run build` - Next.js production build ✅

---

## 7. Files Modified Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/migrations/20260202010000_relax_account_grouping_constraint.sql` | **Created** | Makes `group_id` nullable |
| `supabase/migrations/20260202010001_add_transaction_accountid_validation.sql` | **Created** | Adds validation gate to RPC |
| `supabase/migrations/20260202010002_zombie_cleanup_orphaned_transactions.sql` | **Created** | Removes orphaned transactions |
| `supabase/migrations/20260127000000_batch_upsert_transactions.sql` | **Modified** | Added validation gate (also in new migration) |
| `lib/sync/pull-engine.ts` | **Modified** | Added self-healing `group_id` generation |
| `lib/sync/initial-hydration-service.ts` | **Modified** | Added self-healing `group_id` generation |
| `lib/sync/push-engine.ts` | **Modified** | Added validation, null handling, CONFLICT marking |
| `lib/sync/types.ts` | **Modified** | Made `PendingRecord.data` nullable |
| `lib/sync/__tests__/push-engine.test.ts` | **Modified** | Fixed nullable data assertions |

---

## 8. Verification Results

| Check | Result |
|-------|--------|
| TypeScript Compilation | ✅ Pass |
| Next.js Build | ✅ Pass |
| Migration: relax_account_grouping_constraint | ✅ Applied |
| Migration: add_transaction_accountid_validation | ✅ Applied |
| Migration: zombie_cleanup_orphaned_transactions | ✅ Applied (0 orphans found) |

---

## 9. Expected Behavior After Fix

### 9.1 batch_upsert_accounts
- Returns 200 OK even if `group_id` is null
- Record inserted with null `group_id` (schema now allows it)
- Pull Engine will heal the value on next pull

### 9.2 batch_upsert_transactions
- Returns 200 OK with friendly error in `error_map` for null `account_id`:
  ```json
  {
    "error_map": {
      "<uuid>": "LEGAL_REJECTION: Main ledger transactions require an account_id. Use transaction_inbox for orphaned items."
    },
    "synced_ids": [...],  // Other valid records still sync
    "conflict_ids": [...]
  }
  ```

### 9.3 Push Engine
- Blocks transactions without `account_id` before sending
- Marks blocked records as `CONFLICT` status
- Logs warning for debugging

### 9.4 Pull Engine / Initial Hydration
- Auto-generates `group_id` for accounts with null value
- UI grouping works correctly even for legacy data

---

## 10. Lessons Learned

1. **UPDATE vs INSERT paths need parity** - If UPDATE uses COALESCE for safety, INSERT should have equivalent protection.

2. **Don't generate fake foreign keys** - `gen_random_uuid()` for FKs creates "ghost" relationships that cause downstream issues.

3. **Multi-layer defense** - Database constraints are the last line of defense. Validate earlier in the pipeline (Pull Engine, Push Engine) for better error messages and graceful handling.

4. **In-place migration edits don't re-apply** - Always create new migration files for changes to deployed functions.

5. **Mark failed records to prevent retry loops** - When blocking a sync, mark the record with a terminal status (CONFLICT) so it doesn't retry indefinitely.

---

## 11. Future Recommendations

1. **Add `syncError` field to models** - Would allow storing specific error messages per record for better debugging.

2. **Add repository-level guards** - Fail fast if `groupId` is missing at account creation time (though current code already generates it).

3. **Audit Data Import Service** - Ensure any CSV/API import paths have sanitizers for required fields.

4. **Add test runner** - Configure Jest/Vitest for the project to enable automated testing.

---

*Document generated: 2026-02-02*
*Author: Claude Code*
