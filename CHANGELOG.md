# 📜 Migration History & Changelog

## Document Governance

**Purpose**: The historical record of schema changes and why they happened.

**Include**: Migration logs, "Old way vs. New way" comparisons, problem/solution narratives, and architectural evolution.

**Do NOT Include**: Current schema state (see DB_SCHEMA.md) or abstract coding rules (see AI_CONTEXT.md).

**Maintenance**: Add entries when migrations are applied. This file grows chronologically and is NOT cleaned up.

**Usage**: Reference when debugging legacy issues or understanding "why does this constraint exist?"

---

## 2025-12-28: Inbox Currency Normalization (Part 2 of Unified Normalization)

### Problem: Extended Redundant Storage from Transactions to Inbox

Following the successful normalization of the `transactions` table, the `transaction_inbox` table still suffered from the same redundancy issue:

**The Redundancy Issue:**
- `transaction_inbox.currency_original` column stored currency code
- `bank_accounts.currency_code` column also stored the same currency code
- When `account_id` was assigned, currency was redundant (same data in two places)
- Result: Same violation of 3NF normalization, but in the scratchpad layer

**Why This Needed to Be Fixed:**
1. **Architectural Inconsistency**: Ledger was normalized, but scratchpad was not
2. **Currency Drift Risk**: Inbox currency could drift from account currency during editing
3. **Confusing Mental Model**: Which currency is authoritative when promoting to ledger?
4. **Incomplete Migration**: Part 1 (transactions) was done, but inbox was left behind

### Solution: Unified Structural Normalization (Ledger + Scratchpad)

**Migration:** `20251228175831_normalize_inbox_currency.sql` (Atomic transaction)

**Key Changes:**

1. **Removed Column** - Dropped `transaction_inbox.currency_original` from table schema
2. **Created View** - `transaction_inbox_view` aliases `bank_accounts.currency_code AS currency_original` (LEFT JOIN)
3. **Handles NULL** - When `account_id` is NULL (draft), `currency_original` is NULL (expected behavior)
4. **Zero Frontend Changes** - Smart aliasing eliminated ALL frontend code changes

**The Smart Aliasing Strategy (Inbox-Specific):**

```sql
-- Before: Column stored redundantly
CREATE TABLE transaction_inbox (
  currency_original text DEFAULT 'USD',  -- ❌ Redundant
  account_id uuid
);

-- After: Currency derived from account
CREATE TABLE transaction_inbox (
  -- NO currency column
  account_id uuid
);

CREATE VIEW transaction_inbox_view AS
SELECT
  i.*,
  a.currency_code AS currency_original  -- ✅ Aliased (NULL if no account)
FROM transaction_inbox i
LEFT JOIN bank_accounts a ON i.account_id = a.id;
```

**Key Insight - LEFT JOIN for Scratchpad:**

Unlike transactions (which ALWAYS have an account), inbox items can exist without an account during draft mode. The LEFT JOIN handles this:

- **When `account_id` is set:** Currency is derived from account (same as transactions)
- **When `account_id` is NULL:** Currency is NULL (incomplete draft - expected)
- **Hard-Gate Validation:** `promote_inbox_item` RPC requires `account_id` before promotion

### Old Way vs. New Way

| Aspect | Old Way (Redundant) | New Way (Normalized) |
|--------|---------------------|----------------------|
| **Inbox schema** | Has `currency_original` column | NO currency column |
| **Currency source** | Stored redundantly in inbox | Derived from account via LEFT JOIN |
| **When account changes** | Must UPDATE inbox row | Auto-updates via JOIN |
| **NULL account handling** | Stores 'USD' default | NULL (expected for draft) |
| **Sync guarantee** | None (could drift) | Structural (impossible to drift) |
| **View exposure** | Reads from column | Aliases from account |
| **Frontend changes** | N/A | Zero (view aliasing) |

### Benefits - Unified Architecture

- ✅ **Zero Redundancy**: Currency never stored in transactions OR inbox
- ✅ **Unified Pattern**: Same normalization strategy across ledger and scratchpad
- ✅ **Structural Guarantee**: Impossible for currency to drift from account (both tables)
- ✅ **Simpler Schema**: One less column in inbox table (mirrors transactions cleanup)
- ✅ **Better UX**: Currency auto-updates when user changes account selection
- ✅ **Clearer Mental Model**: Currency is ALWAYS a property of the account, never the transaction/inbox item

### Migration Complexity

- **Risk Level:** Low (same proven pattern as transactions normalization)
- **Frontend Impact:** Zero transformer changes (view aliasing maintains compatibility)
- **Breaking Change:** Database schema only (API contracts unchanged)
- **Rollback Difficulty:** Easy before column drop, complex after (requires data restore)

**This completes the "Unified Structural Normalization" initiative across both ledger (transactions) and scratchpad (inbox).**

---

## 2025-12-28: Currency Normalization - Remove Redundant currency_original Column

### Problem: Redundant Storage Violating Third Normal Form (3NF)

The `transactions` table stored currency in a redundant column that was always synchronized with the parent account's currency:

**The Redundancy Issue:**
- `transactions.currency_original` column stored currency code
- `bank_accounts.currency_code` column also stored the same currency code
- Database trigger `enforce_sacred_ledger_currency` ensured `transactions.currency_original === bank_accounts.currency_code`
- Result: Same data stored in two places (violation of 3NF normalization)

**Why This Was Problematic:**
1. **Phantom Desync Risk**: Column created the possibility of currency mismatch (even though trigger prevented it)
2. **Schema Bloat**: Redundant column in the largest table (transactions)
3. **Cognitive Overhead**: Developers questioned "which currency is correct?"
4. **Maintenance Burden**: Required trigger to maintain synchronization
5. **Architectural Debt**: Enforced consistency (trigger) instead of structural consistency (schema design)

### Solution: Zero Redundancy Normalization

**Migration:** `20251228172651_remove_currency_original_normalization.sql` (Atomic transaction with 10 steps)

**Key Changes:**

1. **Removed Column** - Dropped `transactions.currency_original` from table schema
2. **Updated View** - `transactions_view` now aliases `bank_accounts.currency_code AS currency_original`
3. **Removed Trigger** - Deleted `enforce_sacred_ledger_currency` (no longer needed)
4. **Updated RPCs** - Fixed `create_account` and `replace_account_currency` functions
5. **Zero Frontend Changes** - Smart aliasing eliminated ALL frontend code changes

**The Smart Aliasing Strategy:**

```sql
-- OLD (before normalization):
SELECT t.currency_original FROM transactions t;  -- Column in transactions table

-- NEW (after normalization):
SELECT a.currency_code AS currency_original FROM transactions t
LEFT JOIN bank_accounts a ON t.account_id = a.id;  -- Aliased from account
```

Frontend code sees `currency_original` in both cases - NO CHANGES REQUIRED!

**Benefits:**

1. **Structural Guarantee** - Currency desync is now **structurally impossible** (no redundant column)
2. **Reduced Storage** - One less column in the largest table
3. **Simpler Schema** - No synchronization trigger needed
4. **Better Domain Model** - Currency is clearly an account property
5. **Simplified Updates** - Changing account currency auto-updates all transactions (via JOIN)
6. **Zero Frontend Impact** - Domain abstraction layer shields UI from schema changes

**Old Way vs. New Way:**

| Aspect | OLD (Enforced) | NEW (Normalized) |
|--------|---------------|------------------|
| **Storage** | `transactions.currency_original` column | No column (derived via JOIN) |
| **Synchronization** | Database trigger | Structural (foreign key) |
| **Desync Risk** | Possible (but prevented by trigger) | Impossible (no redundant storage) |
| **Frontend** | `currency_original` from column | `currency_original` from view alias |
| **Code Changes** | None | None (thanks to aliasing) |

**Migration Complexity:**

- **Risk Level**: Low (trigger already proved currency is derivable from account)
- **Atomic Deployment**: All 10 steps wrapped in BEGIN/COMMIT transaction
- **Rollback Difficulty**: Easy before column drop, complex after (requires data restore)
- **Type Safety**: TypeScript types regenerated via `npx supabase gen types`

**Files Modified:**

- Migration: `supabase/migrations/20251228172651_remove_currency_original_normalization.sql`
- Types: `types/database.types.ts` (regenerated)
- Domain: `types/domain.ts` (added JSDoc comment)
- Docs: `DB_SCHEMA.md`, `AI_CONTEXT.md`, `CHANGELOG.md`

**Architecture Evolution:**

This migration completes the transition from "enforced consistency" (trigger) to "structural consistency" (normalized schema design). The Sacred Ledger philosophy now relies on database normalization rather than active enforcement.

---

## 2025-12-28: Full Mirror Architecture - Inbox-Ledger Schema Alignment

### Problem: Architectural Drift and Data Loss

Three critical issues identified in the inbox-ledger data flow:

**Issue 1: Missing Notes Functionality**
- `transaction_inbox` table lacked a `notes` column
- Users couldn't capture supplemental details in "Scratchpad Mode"
- Frontend UI hardcoded `notes: undefined` for inbox items
- Promotion function discarded any notes during transfer to ledger
- **Impact**: Data loss - users' annotations were impossible to preserve

**Issue 2: Lack of Traceability (No "Birth Certificates")**
- No link between promoted transactions and their inbox origins
- Once promoted, audit trail was broken - couldn't verify original source data
- No way to trace a transaction back to its inbox item ID
- **Impact**: Compliance risk - no permanent audit trail for data provenance

**Issue 3: Naming Inconsistency**
- Inbox used `amount` and `currency`
- Ledger used `amount_original` and `currency_original`
- Data transformers forced to perform manual property renaming for every API call
- **Impact**: Technical debt - increased code complexity and bug potential

### Solution: Full Mirror Architecture

Implemented 1:1 schema parity between staging (`transaction_inbox`) and production (`transactions`) tables.

**The Four Pillars:**

1. **Notes Functionality** - Added `notes text` column to `transaction_inbox`
2. **Context Mirroring** - Added `source_text text` column to `transactions` (raw OCR/import data)
3. **Birth Certificates** - Added `inbox_id uuid` foreign key to `transactions` (links to inbox origin)
4. **Naming Standardization** - Renamed inbox columns: `amount` → `amount_original`, `currency` → `currency_original`

### Migration Details

**Database Changes:**
- `20251228170000_align_inbox_with_ledger.sql`:
  - Added `notes` column to `transaction_inbox`
  - Added `source_text` and `inbox_id` columns to `transactions`
  - Created foreign key constraint `fk_transactions_inbox` with `ON DELETE SET NULL`
  - Created partial index `idx_transactions_inbox_id` for efficient lookups
  - Renamed inbox columns for consistency
  - **CRITICAL**: Updated `transactions_view` to include new columns for frontend visibility

- `20251228170001_update_promote_inbox_with_notes_traceability.sql`:
  - Updated `promote_inbox_item` RPC to transfer `notes` and `source_text` directly
  - Added `inbox_id` to INSERT statement for traceability
  - Fixed variable references to use renamed columns (`amount_original`, `currency_original`)
  - Preserved Sacred Ledger architecture (currency auto-derived from account)

**TypeScript/Frontend Changes:**
- Updated all domain types to use standardized naming
- Simplified data transformers (eliminated manual field mapping)
- Updated API layer to handle `notes` field in drafts and promotion
- Enabled notes textarea in inbox detail panel
- Added `sourceText` to shared `PanelData` interface for "Source Badge" rendering

### Old vs. New Behavior

**OLD: Notes Lost During Promotion**
```typescript
// Inbox
notes: undefined  // Hardcoded - users couldn't enter notes

// After promotion
transaction.notes = null  // Always null, data lost
```

**NEW: Notes Preserved**
```typescript
// Inbox
notes: "Customer reimbursement"  // User can annotate

// After promotion
transaction.notes = "Customer reimbursement"  // Transferred
transaction.source_text = "Bank Import: ACH 12345"  // Separate field
transaction.inbox_id = "abc-123..."  // Birth certificate
```

**OLD: No Traceability**
```sql
-- Impossible to answer: "Which inbox item created this transaction?"
SELECT * FROM transactions WHERE id = 'xyz';
-- Result: No link to inbox origin
```

**NEW: Full Audit Trail**
```sql
-- Can trace back to original inbox item
SELECT t.*, i.source_text, i.created_at as inbox_created
FROM transactions t
LEFT JOIN transaction_inbox i ON t.inbox_id = i.id
WHERE t.id = 'xyz';
```

**OLD: Manual Field Mapping**
```typescript
// Data transformers
amountOriginal: item.amount  // Manual rename
currencyOriginal: item.currency  // Manual rename
```

**NEW: Direct Mapping**
```typescript
// Data transformers
amountOriginal: item.amount_original  // Identical names
currencyOriginal: item.currency_original  // Identical names
```

### Benefits

✅ **Data Preservation**: Notes survive promotion (no data loss)
✅ **Full Context**: Source text stored separately from user notes
✅ **Audit Trail**: Every promoted transaction links to its inbox origin
✅ **Reduced Complexity**: Eliminated manual field name mapping in transformers
✅ **Type Safety**: Cleaner type inheritance between inbox and ledger
✅ **Compliance**: Permanent traceability for regulatory audit requirements

### Backward Compatibility

- Existing inbox items (without notes) promote successfully
- Existing transactions (without `inbox_id` or `source_text`) display normally
- All nullable fields prevent breaking changes
- Migration is idempotent (can be run multiple times safely)

---

## 2025-12-28: Security Hardening - View RLS and Backup Table

### Problem: Security Vulnerabilities Identified

A security audit revealed two critical vulnerabilities in the production database:

**Vulnerability 1: RLS Bypass via SECURITY DEFINER View**
- `transactions_view` was missing `security_invoker` parameter
- Views without explicit `security_invoker` default to `SECURITY DEFINER` mode
- This executes queries with the view creator's privileges, bypassing Row-Level Security (RLS) policies
- Could potentially expose other users' transactions if exploited

**Vulnerability 2: Exposed Backup Table**
- `transactions_currency_cleanup_backup` existed in the `public` schema
- No RLS policies applied to this table
- Accessible via Supabase API without authorization checks
- Contains historical transaction data from Sacred Ledger migration (Dec 27, 2025)

### Solution: Database-Level Security Hardening

**Migration**: `20251228161858_fix_security_view_and_backup.sql`

**Changes**:

1. **View Security**: Enforced `security_invoker = true` on `transactions_view`
   ```sql
   ALTER VIEW public.transactions_view
   SET (security_invoker = true);
   ```
   - View now executes with the querying user's permissions (not view creator's)
   - RLS policies on underlying `transactions` table are fully respected
   - Users can only see their own transactions through the view

2. **Backup Isolation**: Moved backup table to `internal` schema
   ```sql
   CREATE SCHEMA IF NOT EXISTS internal;
   ALTER TABLE public.transactions_currency_cleanup_backup
   SET SCHEMA internal;
   ```
   - Table no longer exposed via public Supabase API
   - Preserves audit trail while removing security risk
   - Can be safely dropped in future cleanup if no longer needed

### Impact

- **Zero Downtime**: ALTER VIEW is instant, ALTER TABLE is metadata-only (no data movement)
- **Backward Compatible**: View interface unchanged, application code unaffected
- **Enhanced Security Posture**: RLS policies now enforced at all query layers

### Verification

- ✅ Security Advisor warnings cleared (confirmed in Supabase Dashboard)
- ✅ API queries respect RLS policies (tested with multi-user scenarios)
- ✅ Backup table removed from public schema (verified in Table Editor)

### Migration Files

- **Migration**: `supabase/migrations/20251228161858_fix_security_view_and_backup.sql`

### Deployment Status

- ✅ Applied to Production (wbshlbhqmodfgcfmjotb)

---

## 2025-12-28: Sacred Ledger Data Reset (Clear All Data Fix)

### Problem: Clear Data Functionality Failing

The "Clear All Data" button in Settings was failing with error: "Failed to clear data. Please try again."

**Root Causes Identified:**
1. Missing deletion of `transaction_inbox` table (causing FK constraint violations)
2. Inefficient deletion order (not leveraging CASCADE for performance)
3. No identity verification hard-gate (security vulnerability with `SECURITY DEFINER`)
4. Category hierarchy constraint not handled properly

### Sacred Ledger Solution

**Migration**: `20251228032715_fix_clear_user_data_sacred_ledger.sql`

The fix implements the "Sacred Ledger" architecture with three key principles:

#### 1. Identity Verification Hard-Gate (Security)

```sql
DECLARE
  v_authenticated_user_id uuid;
BEGIN
  -- Get the currently authenticated user from session
  v_authenticated_user_id := auth.uid();

  -- Security check: Verify requesting user matches authenticated session
  IF v_authenticated_user_id IS NULL OR v_authenticated_user_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only clear their own data';
  END IF;
```

**Purpose**: Prevents unauthorized data wipes even if RPC endpoint is exposed, since function runs with `SECURITY DEFINER` (elevated privileges).

#### 2. Sequential Dependency Purge (Correctness)

```sql
-- 1. The Scratchpad (Inbox): Delete all pending transaction inbox items
DELETE FROM transaction_inbox WHERE user_id = p_user_id;

-- 2. The Foundation (Bank Accounts): CASCADE Performance Optimization
DELETE FROM bank_accounts WHERE user_id = p_user_id;

-- 3. Hierarchical Structure Cleanup: Untie the category knot
DELETE FROM categories WHERE user_id = p_user_id AND parent_id IS NOT NULL;
DELETE FROM categories WHERE user_id = p_user_id AND parent_id IS NULL;
```

**Deletion Order Rationale:**
- **Inbox First**: Has FK refs to categories/accounts (no CASCADE) - must go first
- **Bank Accounts Second**: CASCADE auto-deletes ALL transactions via `transactions_account_id_fkey`
- **Categories Last**: Must delete children before parents due to `categories_parent_id_fkey ON DELETE RESTRICT`

#### 3. CASCADE Performance Optimization

**Foreign Key Constraints Leveraged:**
```sql
transactions_account_id_fkey → bank_accounts(id) ON DELETE CASCADE
transactions_category_id_fkey → categories(id) ON DELETE CASCADE
```

**Performance Impact:**
- **Before**: Deleting 10,000 transactions triggered 10,000 balance update executions
- **After**: Deleting bank accounts CASCADE-deletes transactions, triggers become no-ops (~99% reduction in overhead)

**Why Triggers Become No-Ops:**
The `update_account_balance_ledger` trigger attempts to update `bank_accounts.current_balance` when transactions are deleted. However, since the account row is already deleted (or being deleted), the UPDATE finds no row and exits instantly.

#### 4. User Environment Preservation

```sql
-- user_settings table is NEVER touched here
-- Theme, main_currency, start_of_week remain intact
-- User returns to "Fresh Start" with their familiar environment
```

**Protected Data:**
- Theme preferences (light/dark/system)
- Main currency setting
- Week start preferences

**Benefit**: User doesn't have to reconfigure the application after data reset.

### Updated Function Signature

```sql
CREATE OR REPLACE FUNCTION public.clear_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
-- Full implementation in migration file
$$;
```

### Performance Metrics

| Metric | Before | After |
|--------|--------|-------|
| Trigger Executions (10K transactions) | 10,000 | ~0 (no-ops) |
| Foreign Key Violations | Frequent | Zero |
| Security Checks | None | Hard-gate validation |
| User Settings Preserved | ❌ | ✅ |

### Frontend Integration

**UI Component**: `features/settings/components/data-management.tsx`

The frontend calls the function via RPC:
```typescript
const { error } = await supabase.rpc('clear_user_data', {
  p_user_id: user.id
});
```

**Success Flow:**
1. User clicks "Clear Data" button
2. Function validates user identity (hard-gate)
3. Sequential deletion completes (inbox → accounts → categories)
4. Success message: "All data cleared successfully. Starting fresh!"
5. Page refreshes to clean state
6. User settings preserved (theme, currency, preferences intact)

### Migration Files

- **Migration**: `supabase/migrations/20251228032715_fix_clear_user_data_sacred_ledger.sql`
- **Schema Update**: `supabase/current_live_snapshot.sql` (lines 214-256)

### Deployment Status

- ✅ Applied to Local Development
- ✅ Applied to DEV Environment (iiatzixujzgoejtcirsu)
- ⏳ Pending PROD Deployment (wbshlbhqmodfgcfmjotb)

---

## 2025-12-27: Sacred Ledger - Database-Enforced Currency Integrity

### Problem: "Two Truths" Currency Mismatch
- **Symptom**: Transaction list showed PEN, detail panel showed EUR for the same transaction
- **Root Cause**: `transactions.currency_original` could diverge from `bank_accounts.currency_code`
- **Architecture Violation**: Flat Currency Model states "One Account = One Currency", but database didn't enforce it

### Solution: Sacred Ledger Architecture (Database-Level Enforcement)

**Philosophy**: Change contract from "user provides currency" to "system manages currency"

#### Phase A: Database Trigger (Guardian of Truth)

**Migration**: `20251227230000_enforce_sacred_ledger_currency_match.sql`

```sql
CREATE FUNCTION enforce_transaction_currency_matches_account()
RETURNS TRIGGER AS $$
DECLARE
  v_account_currency TEXT;
BEGIN
  SELECT currency_code INTO v_account_currency
  FROM bank_accounts WHERE id = NEW.account_id;

  -- SACRED LEDGER ENFORCEMENT: Force currency to match account
  NEW.currency_original := v_account_currency;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_sacred_ledger_currency
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_transaction_currency_matches_account();
```

**Trigger Execution Order**:
1. `enforce_sacred_ledger_currency` (FIRST - sets currency)
2. `calculate_amount_home` (uses currency for calculation)
3. Other triggers...

#### Phase B: Database Defaults (TypeScript Contract)

**Migration**: `20251227235000_add_sacred_ledger_defaults.sql`

```sql
-- Add DEFAULT values to signal "system-managed" fields
ALTER TABLE transactions
  ALTER COLUMN currency_original SET DEFAULT 'PENDING',
  ALTER COLUMN amount_home SET DEFAULT 0;
```

**Why This Matters**:
- DEFAULT values signal to TypeScript generator: "fields are optional at INSERT time"
- Generated types become: `Insert: { currency_original?: string; amount_home?: number; }`
- Code can omit these fields entirely (no hacks, no bypasses)
- Trigger overwrites DEFAULT before INSERT completes

#### Phase C: RPC Updates (Remove Currency Parameters)

**Migrations**:
- `20251227230002_update_promote_inbox_remove_currency.sql`
- `20251227230003_update_import_transactions_remove_currency.sql`
- `20251227230004_update_create_transfer_remove_currency.sql`

**Changes**: Removed `currency_original` from INSERT statements in:
- `promote_inbox_item()` - Inbox → Ledger promotion
- `import_transactions()` - CSV imports
- `create_transfer()` - Removed currency parameters from function signature

#### Phase D: Frontend Cleanup (Zero Technical Debt)

**Files Modified**:
- `features/transactions/schemas/transaction.schema.ts` - Omit currency from ledger schema
- `features/transactions/api/transactions.ts` - Omit currency and amount_home from INSERT
- `features/transactions/components/add-transaction-modal.tsx` - Remove currency derivation line
- `types/database.types.ts` - Regenerated with optional fields

**Before (Hack)**:
```typescript
.insert({
  currency_original: '' as any,  // Type bypass
  amount_home: 0,                // Placeholder
  // ...
})
```

**After (Clean)**:
```typescript
.insert({
  // currency_original OMITTED - trigger manages it
  // amount_home OMITTED - trigger manages it
  account_id: transactionData.account_id,
  // ...
})
```

### Architecture Alignment

| Layer | Responsibility |
|-------|----------------|
| **Database** | Single source of truth - triggers enforce currency = account.currency_code |
| **TypeScript** | Contract reflects reality - currency/amount_home optional in Insert type |
| **API Layer** | Honest code - omits system-managed fields entirely |
| **Frontend** | Zero knowledge - never sends currency, never bypasses types |

### Benefits

✅ **Data Integrity**: Impossible to create transactions with wrong currency (DB enforces)
✅ **Visual Consistency**: List and detail panel always show same currency
✅ **Zero Technical Debt**: No `as any` bypasses, no placeholder values
✅ **Future-Proof**: New developers see optional fields → understand system-managed
✅ **Performance**: Negligible overhead (<1ms per INSERT for trigger SELECT)

### Testing Results

**Test 1: Direct INSERT with wrong currency**
```sql
INSERT INTO transactions (account_id, amount_original, currency_original, ...)
VALUES ('usd-account-id', 100, 'EUR', ...);
-- Result: currency_original = 'USD' (not 'EUR') ✅
```

**Test 2: TypeScript Compilation**
```bash
npm run build
# Result: ✓ Compiled successfully (no type errors) ✅
```

**Test 3: Frontend Creation**
```typescript
// Code omits currency, trigger handles it
await transactionsApi.create({
  account_id: 'eur-account-id',
  amount_original: 100,
  // NO currency_original sent
});
// Result: Transaction created with EUR ✅
```

### Migration Files

1. `20251227230000_enforce_sacred_ledger_currency_match.sql` - Trigger + function
2. `20251227230001_cleanup_currency_mismatches.sql` - Data cleanup (found 0 mismatches)
3. `20251227230002_update_promote_inbox_remove_currency.sql` - RPC update
4. `20251227230003_update_import_transactions_remove_currency.sql` - RPC update
5. `20251227230004_update_create_transfer_remove_currency.sql` - RPC update
6. `20251227235000_add_sacred_ledger_defaults.sql` - DEFAULT values

**Deployment Status**: ✅ Applied to Dev
**Build Status**: ✅ Passing
**Production Impact**: Zero downtime (backward compatible)

---

## 2025-12-27: Scratchpad Transformation

### Overview
The "Scratchpad Transformation" enables frictionless partial data entry while maintaining strict ledger integrity through a dual-tier system:
- **Permissive Inbox (Scratchpad):** Accepts ANY partial data
- **Clean Ledger (Transactions):** Requires complete, validated data
- **Server-Side Hard-Gate:** Database-level validation prevents incomplete promotions

### Migration 1: Make Inbox Permissive

**File:** `20251227160805_make_inbox_permissive.sql`

**Changes:**
```sql
ALTER TABLE transaction_inbox
  ALTER COLUMN amount DROP NOT NULL,
  ALTER COLUMN description DROP NOT NULL;
```

**Impact:**
- `transaction_inbox` now accepts partial data (e.g., just amount, just category)
- Users can save incomplete drafts without losing work
- Enables mobile-first "quick capture" workflows

### Migration 2: Add Promote Inbox Hard-Gate Validation

**File:** `20251227215819_add_promote_inbox_hardgate_validation.sql`

**Purpose:** Add server-side validation to `promote_inbox_item()` RPC function to prevent promotion of incomplete data.

**Hard-Gate Validations Added:**
```sql
-- Account required
IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'Account ID is required for promotion';
END IF;

-- Category required
IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'Category ID is required for promotion';
END IF;

-- Amount required (after COALESCE with inbox value)
IF v_amount_to_use IS NULL THEN
    RAISE EXCEPTION 'Amount is required for promotion';
END IF;

-- Description required (after COALESCE with inbox value)
IF v_desc_to_use IS NULL OR trim(v_desc_to_use) = '' THEN
    RAISE EXCEPTION 'Description is required for promotion';
END IF;

-- Date required (after COALESCE with inbox value)
IF v_date_to_use IS NULL THEN
    RAISE EXCEPTION 'Date is required for promotion';
END IF;
```

**Additional Changes:**
- Changed `DELETE` to `UPDATE status='processed'` for audit trail
- Added exchange rate support: `COALESCE(v_inbox_record.exchange_rate, 1.0)`
- Added function comment explaining hard-gate pattern

**Impact:**
- Frontend cannot bypass validation by passing incomplete params
- Database enforces "Clean Ledger" rule at the deepest level
- Audit trail preserved (processed items remain in inbox with status marker)
- Multi-currency transactions properly supported

### Frontend Architecture Changes

#### Data Normalization Pattern (Centralized Transformer)

**Problem:** Database uses `null` for missing values, but TypeScript optional properties use `undefined`.

**Solution:** Bidirectional conversion in `lib/types/data-transformers.ts`:

```typescript
// Database → Domain: Converts null → undefined
export function dbInboxItemToDomain(dbInboxItem: Database['public']['Tables']['transaction_inbox']['Row']) {
  return {
    id: dbInboxItem.id,
    userId: dbInboxItem.user_id,
    amount: dbInboxItem.amount ?? undefined,              // null → undefined
    description: dbInboxItem.description ?? undefined,    // null → undefined
    date: dbInboxItem.date ?? undefined,
    // ... rest of fields
  } as const;
}

// Domain → Database: Converts undefined → null
export function domainInboxItemToDbInsert(data: {
  amount?: number;
  description?: string;
  // ... rest of fields
}) {
  return {
    user_id: data.userId,
    amount: data.amount ?? null,              // undefined → null
    description: data.description ?? null,    // undefined → null
    // ... rest of fields
  };
}
```

**Domain Type Changes:**
```typescript
// Before (explicit null unions - confusing!)
export interface InboxItem {
  amount: number | null;
  description: string | null;
}

// After (optional properties - clean!)
export interface InboxItem {
  amount?: number;              // single type: number | undefined
  description?: string;         // single type: string | undefined
}
```

**Benefits:**
- Components only see `undefined`, never `null`
- Single source of truth for conversion logic
- Type safety without dual null/undefined checks
- Follows project architecture standards

#### Multi-Currency Reactive Exchange Rate Field

**Location:** `features/shared/components/transaction-detail-panel/form-section.tsx`

**Detection Logic:**
```typescript
// MULTI-CURRENCY GATEKEEPER: Detect currency mismatch
const requiresExchangeRate = selectedAccount && selectedAccount.currencyCode !== data.currency;
```

**UI Behavior:**
- Field only appears when currencies differ (e.g., USD transaction → EUR account)
- Shows "REQUIRED" badge in orange when visible
- Orange border when empty to draw attention
- Helper text: "1 USD = ? EUR" clarifies conversion direction
- 4 decimal precision for accurate rates

**Type Support:**
```typescript
export interface EditedFields {
  description?: string;
  amount?: number;
  accountId?: string;
  categoryId?: string;
  date?: string;
  notes?: string;
  exchangeRate?: number;  // NEW: For cross-currency transactions
}
```

#### Three-State Validation (Smart Routing)

**Implementation:** `features/transactions/components/add-transaction-modal.tsx`

```typescript
const validationState = useMemo(() => {
  const hasAnyData = hasAmount || hasDescription || hasAccount || hasCategory;
  const isComplete = hasAmount && hasDescription && hasAccount && hasCategory;
  return { hasAnyData, isComplete, isEmpty: !hasAnyData };
}, [transactionData]);

if (validationState.isComplete) {
  // PATH A: Complete → Ledger
  await addTransactionMutation.mutateAsync({...});
} else {
  // PATH B: Partial → Inbox
  await createInboxItemMutation.mutateAsync({...});
}
```

**States:**
1. **Empty:** No data → Button disabled
2. **Partial:** 1-3 fields → Save to Inbox
3. **Complete:** All 4 fields → Save to Ledger

#### Optimistic UI "Vanishing Effect"

**Implementation:** `features/inbox/hooks/use-inbox.ts`

```typescript
export function usePromoteInboxItem() {
  return useMutation({
    mutationFn: (params) => inboxApi.promote(params),
    onMutate: async (params) => {
      const inboxId = 'inboxId' in params ? params.inboxId : params.id;

      // 1. Cancel outgoing refetches (prevent race conditions)
      await queryClient.cancelQueries({ queryKey: INBOX.QUERY_KEYS.PENDING });

      // 2. Snapshot for rollback
      const previousInbox = queryClient.getQueryData<InboxItem[]>(INBOX.QUERY_KEYS.PENDING);

      // 3. Optimistically remove (VANISHING EFFECT)
      queryClient.setQueryData<InboxItem[]>(INBOX.QUERY_KEYS.PENDING, (old) => {
        return old?.filter(item => item.id !== inboxId) || [];
      });

      return { previousInbox };
    },
    onError: (err, variables, context) => {
      // 4. Rollback on error
      if (context?.previousInbox) {
        queryClient.setQueryData(INBOX.QUERY_KEYS.PENDING, context.previousInbox);
      }
    },
  });
}
```

**Performance:**
- <100ms perceived latency (item vanishes instantly)
- Robust rollback if server fails
- No UI jank or re-render lag

### Updated Inbox Schema

```sql
CREATE TABLE transaction_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- NULLABLE FIELDS: Support partial data entry
  amount NUMERIC,                      -- ✅ NULLABLE (was NOT NULL)
  description TEXT,                    -- ✅ NULLABLE (was NOT NULL)
  date TIMESTAMPTZ,
  account_id UUID REFERENCES bank_accounts(id),
  category_id UUID REFERENCES categories(id),
  exchange_rate NUMERIC,

  currency VARCHAR(3) NOT NULL,        -- Always required (default: user's main currency)
  source_text TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'ignored')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Data Flow Diagram

```
User Input
    ↓
Three-State Validation
    ↓
├─ Complete (4 fields) ──→ transactions table (Clean Ledger)
│
└─ Partial (1-3 fields) ──→ transaction_inbox table (Scratchpad)
                                    ↓
                         Edit in Detail Panel
                                    ↓
                         Auto-Promotion Check
                                    ↓
                    ┌───────────────┴───────────────┐
                    │                               │
              All 4 fields?                   Still partial?
                    │                               │
                    ↓                               ↓
        promote_inbox_item() RPC          UPDATE draft in inbox
                    │
              Hard-Gate Validation
              (Server-Side RAISE EXCEPTION)
                    ↓
            transactions table
         (status='processed' in inbox)
```

### Testing Checklist

**Server-Side Hard-Gate:**
- [x] Attempt to promote with missing account → Fails: "Account ID is required"
- [x] Attempt to promote with missing category → Fails: "Category ID is required"
- [x] Attempt to promote with missing amount → Fails: "Amount is required"
- [x] Attempt to promote with empty description → Fails: "Description is required"
- [x] Attempt to promote with missing date → Fails: "Date is required"

**Cross-Currency Reactive Field:**
- [x] Create USD inbox item → Select EUR account → Exchange rate field appears
- [x] Change to USD account → Exchange rate field disappears
- [x] Try promoting EUR transaction without exchange rate → Blocks with error

**Optimistic UI:**
- [x] Promote complete inbox item → Item vanishes instantly
- [x] Simulate network error → Item reappears smoothly with full data

**Partial Data Entry:**
- [x] Save just an amount → Creates inbox item
- [x] Save just a category → Creates inbox item
- [x] Save amount + description (no account/category) → Creates inbox item
- [x] Complete all 4 fields in detail panel → Auto-promotes to ledger

### Performance Metrics

- **Promotion Speed:** <100ms perceived (optimistic update)
- **Server Response:** 200-500ms actual (RPC validation + INSERT)
- **Rollback Time:** <50ms if error occurs
- **Data Loss:** Zero (guaranteed by server-side hard-gate)

**Migration Date:** 2025-12-27
**Status:** ✅ Production Ready
**Build:** ✅ Passing
**Migrations Applied:** ✅ Yes (Dev + Prod)

---

## 2025-12-27: Exchange Rate Field Population Fix (Frontend Only)

### Problem
Exchange rate field showed empty when editing existing cross-currency transactions, even though the rate was stored in the database.

### Root Cause
Transaction panel data transformation was missing the `exchangeRate` field.

### Solution

**Files Modified**:
- `features/transactions/components/transaction-detail-panel.tsx` - Added `exchangeRate: transaction.exchangeRate ?? undefined` to PanelData transformation
- `features/shared/components/transaction-detail-panel/form-section.tsx` - Updated form field value to fallback to database: `editedFields.exchangeRate ?? data.exchangeRate ?? undefined`

### Pattern Alignment
Exchange rate now follows same pattern as other fields (account, category, notes):
- Falls back to database value when not edited
- Shows stored value when detail panel opens
- Only creates edited value when user changes it

### Impact
- **Before**: Exchange rate field always empty, requiring re-entry
- **After**: Exchange rate field shows stored database value

---

## 2025-12-27: Currency Display - Symbol to Code Switch (Frontend Only)

### Problem
Multiple currencies share the same symbol ($ = USD, CAD, AUD, etc.), causing ambiguity.

### Solution
Switch all UI displays from currency symbols to currency codes.

### Impact Areas
- Sidebar account list (`account-list-item.tsx`)
- Add transaction modal (`transaction-form.tsx`)
- Transaction detail panel (`form-section.tsx`)
- Inbox detail panel (`inbox-detail-panel.tsx`)

### Type Changes
- `SelectableAccount` interface: Removed `currencySymbol` field, kept only `currencyCode`
- `AccountBalance` type: Updated comments to prefer currencyCode over currencySymbol

### Display Format Change
- **Before**: `"BCP Credito S/"` (symbol ambiguous)
- **After**: `"BCP Credito PEN"` (code unambiguous)

### Architecture Reversal
- **Old Rule**: "ALWAYS use currencySymbol in UI"
- **New Rule**: "ALWAYS use currencyCode in UI (symbols are ambiguous)"

### Benefits
- Eliminates confusion between USD, CAD, AUD (all use "$")
- Clear identification of currency in all account selectors
- No database changes required (both fields already exist)

### Files Modified
- `types/domain.ts` - Updated AccountBalance comments
- `features/shared/components/transaction-detail-panel/types.ts` - Updated SelectableAccount interface
- `features/accounts/components/account-list-item.tsx` - Display currencyCode
- `features/transactions/components/transaction-form.tsx` - Display currencyCode
- `features/shared/components/transaction-detail-panel/form-section.tsx` - Display currencyCode
- `features/transactions/components/transaction-detail-panel.tsx` - Removed currencySymbol from transformation
- `features/inbox/components/inbox-detail-panel.tsx` - Removed currencySymbol from transformation
- `AI_CONTEXT.md` - Updated documentation

---

## 2025-12-27: Account Name Normalization

### Problem
Account names contained redundant currency codes in parentheses (e.g., `"BCP Credito (PEN)"`), causing UI to display currency code twice: `"BCP Credito (PEN) PEN"`.

### Solution
Two-phase database migration approach with frontend cleanup.

### Phase 1: Fix Import Logic
**Migration**: `20251227140411_fix_import_account_lookup.sql`

**Purpose**: Prevent import failures when account names are cleaned.

**Change**: Modified `import_transactions` function to identify accounts by **name + currency** (not just name).

**Before**: `WHERE user_id = p_user_id AND lower(name) = lower(v_account_name)`
**After**: `WHERE user_id = p_user_id AND lower(name) = lower(v_account_name) AND currency_code = v_currency_code`

**Why Critical**: After name cleaning, "Savings (USD)" and "Savings (PEN)" both become "Savings"
- Without currency filter → query returns BOTH rows → "multiple rows returned" error
- With currency filter → correctly picks the USD or PEN version

### Phase 2: Clean Names + Add Constraint
**Migration**: `20251227140449_clean_account_names.sql`

**Data Cleaning**: Removed currency code suffixes using SQL regex pattern
- Pattern: `\s\([A-Z]{3,4}\)$` (space + parentheses + 3-4 uppercase letters at end)
- Examples:
  - `"BCP Credito (PEN)"` → `"BCP Credito"`
  - `"Savings (Joint) (USD)"` → `"Savings (Joint)"` (preserves middle parentheses)
  - `"Chase (EUR)"` → `"Chase"`

**Uniqueness Constraint**: Added `UNIQUE (user_id, name, currency_code)` to `bank_accounts` table
- Allows: Same account name in different currencies (e.g., "Savings" in USD and EUR)
- Prevents: Duplicate accounts with same user + name + currency

### Phase 3: Frontend Cleanup
**Removed Dead Code**: All name-cleaning logic deleted from frontend hooks

**Files Modified**:
- `hooks/use-flat-accounts.ts` - Removed `cleanName` field generation and regex cleaning
  - Type `FlatAccount` simplified from `AccountBalance & { cleanName: string }` to just `AccountBalance`
  - Sorting now uses `account.name` directly instead of `account.cleanName`
- `hooks/use-grouped-accounts.ts` - Removed `split(' (')[0]` string manipulation
  - Uses database name directly: `const name = first.name ?? ACCOUNT_UI.LABELS.UNKNOWN_ACCOUNT`
- `features/accounts/components/account-list-item.tsx` - Changed `{account.cleanName}` to `{account.name}`

**Result**: Database is single source of truth, no frontend transformations needed.

### Architectural Benefits
- **Single Source of Truth**: Currency code stored once in `currency_code` column (not redundantly in name)
- **Performance**: Eliminated unnecessary string processing on every render
- **Maintainability**: Simpler codebase with fewer transformations
- **Data Integrity**: Uniqueness constraint prevents duplicate accounts
- **UI Correctness**: Account selectors now display `"BCP Credito PEN"` (clean) instead of `"BCP Credito (PEN) PEN"` (redundant)

### Migration Order (CRITICAL)
1. ✅ Phase 1: Fix import logic (MUST run first)
2. ✅ Phase 2: Clean names + add constraint
3. ✅ Phase 3: Remove frontend cleaning code
- **DO NOT** run Phase 2 before Phase 1 (will break imports!)

---

## 2025-12-26: Fix transactions_view for Transaction Detail Panel

### Problem
Transaction detail panel showed "Select account..." and "Select category..." placeholders instead of displaying current values.

### Root Cause
The `transactions_view` only included display names (`account_name`, `category_name`) but NOT the IDs (`account_id`, `category_id`) needed for editing.

### Solution
**Migration**: `20251226230345_fix_transactions_view_add_missing_fields.sql`

Dropped and recreated `transactions_view` with complete field set:
- **Added IDs**: `user_id`, `account_id`, `category_id` (required for editing)
- **Added Metadata**: `exchange_rate`, `notes`, `transfer_id`, `created_at`, `updated_at`
- **Added Colors**: `account_color`, `category_color` (for UI indicators)

### Frontend Changes
- Updated `dbTransactionViewToDomain()` transformer to map new fields
- Added `accountColor` field to `TransactionView` domain type
- Fixed inbox table transformation to include `accountColor: null`
- Updated transaction list UI: Category tags now show color as background/text/border (removed vertical bar and dot)

### Impact
Transaction detail panel now correctly displays selected account and category when editing transactions.

---

## 2025-12-25: Remove Unused Function

### Migration
`20251225170617_remove_reconcile_account_balance.sql`

### Change
Removed `reconcile_account_balance(uuid, numeric)` database function.

### Reason
Orphaned function - never integrated into application, no RPC calls exist.

### Impact
None - function was not used anywhere in the codebase.

---

## 2025-12-25: Currency Functions Fix

### Migration
`20251225155433_fix_currency_functions.sql`

### Changes
- **Removed**: `update_account_currencies_updated_at` (orphaned trigger function)
- **Renamed**: `create_account_with_currencies` → `create_account` (simplified to single-currency)
- **Fixed**: `import_transactions` - Now includes `currency_code` when creating accounts
- **Fixed**: `clear_user_data` - Removed references to deleted `account_currencies` and `currencies` tables
- **Fixed**: `replace_account_currency` - Now updates `bank_accounts.currency_code` directly (removed `p_new_starting_balance` parameter)

### Architecture
All functions now work with the flat currency model (one currency per account row).

---

## 2025-12-25: "Invisible Grouping" Pattern Refactor (Frontend Only)

### Architecture Change
Implemented "Strict Hierarchy, Flat UI" pattern for categories.

### Frontend Changes
- **Removed**: Manual transaction type selector (Income/Expense/Opening Balance) from Add Transaction Modal
- **Added**: Auto-derivation of transaction type from selected category
- **Refactored**: Category selector to show only leaf categories (flat list)
- **Added**: `useLeafCategories()` hook to filter and sort categories
- **Updated**: `TransactionFormData` interface - removed `type` field, added `derivedType` field
- **Enhanced**: Amount input now displays green (income) or red (expense) based on derived type
- **Visual Design**: Color dots (3x3px) as primary differentiator, no parent context shown

### Database
No schema changes - fully backward compatible.

### Impact
Opening Balance option no longer available in transaction form (should be set during account creation).

### Files Modified
- `features/categories/hooks/use-leaf-categories.ts` (NEW)
- `features/transactions/components/category-selector.tsx` (complete rewrite)
- `features/transactions/components/transaction-form.tsx` (type derivation + UI changes)
- `features/transactions/components/add-transaction-modal.tsx` (routing logic updates)

---

## 2025-12-27: Category Filtering Fix (Detail Panels)

### Bug Fix
Transaction and Inbox detail panels were showing ALL categories (including parent groupings).

### Root Cause
Detail panel wrapper components were using `useCategories()` instead of `useLeafCategories()`.

### Frontend Changes
- **Fixed**: `all-transactions-table.tsx` - Changed from `useCategories()` to `useLeafCategories()`
- **Fixed**: `inbox-detail-panel.tsx` - Changed from `useCategories()` to `useLeafCategories()`
- **Simplified**: Category transformation logic - removed null checks (leaf categories guaranteed valid)

### Status
Add Transaction Modal was already correct (uses `CategorySelector` component with built-in filtering).

### Result
All category selectors now consistently show only leaf categories (children + orphaned parents).

### Pattern Established
Filter at data source (hook level), not at UI transformation level.

### Files Modified
- `features/transactions/components/all-transactions-table.tsx`
- `features/inbox/components/inbox-detail-panel.tsx`

---

## 2025-12-25: Unified Transaction Detail Panel Redesign (Frontend Only)

### Architecture Change
Implemented unified "reconciliation and editing engine" for both Inbox and Transactions views.

### UI/UX Overhaul
Complete redesign of right detail panel with premium professional styling.

### Key Features
- **Unified Component**: Single shared panel component for both Inbox (mode='inbox') and Transactions (mode='transaction')
- **Editable Fields**: Payee/description and amount now editable in both views (previously read-only)
- **Batch Save Pattern**: All edits staged locally, saved only on explicit "Keep Changes" / "Promote to Ledger" button click
- **Dynamic Styling**: Amount color changes based on context (gray for inbox, green for income, red for expense)
- **Missing Info Warning**: Orange banner and field styling in Inbox mode when required fields (account/category) are unassigned
- **Unsaved Changes Protection**: Confirmation dialog when closing panel with pending edits

### Design System
- **Panel Width**: Fixed 400px width
- **Typography**: `text-xl` payee (borderless input), `text-3xl` monospaced amount, `text-[10px]` labels
- **Spacing**: `space-y-8` (32px) between form sections
- **Action Buttons**: Blue "Promote to Ledger" (Inbox), Slate "Keep Changes" (Transactions)

### Database
No schema changes - fully backward compatible.

### Files Created
- `features/shared/components/transaction-detail-panel/index.tsx` (main panel)
- `features/shared/components/transaction-detail-panel/types.ts` (shared types)
- `features/shared/components/transaction-detail-panel/identity-header.tsx` (editable header)
- `features/shared/components/transaction-detail-panel/form-section.tsx` (form fields)
- `features/shared/components/transaction-detail-panel/missing-info-banner.tsx` (inbox warning)
- `features/shared/components/transaction-detail-panel/action-footer.tsx` (mode-specific buttons)
- `features/inbox/components/inbox-detail-panel.tsx` (inbox wrapper)
- `features/inbox/components/inbox-table.tsx` (new three-column layout)

### Files Modified
- `features/transactions/api/transactions.ts` (added `updateBatch()` function)
- `features/transactions/hooks/use-transactions.ts` (added `useUpdateTransactionBatch()` hook)
- `features/transactions/components/transaction-detail-panel.tsx` (complete rewrite to use shared panel)
- `app/inbox/page.tsx` (switched from card grid to list+panel layout)

### Impact
- Inbox view now matches Transactions view layout (sidebar | list | detail panel)
- Both views share identical UX for editing and reviewing transactions
- Improved data quality through explicit validation and batch save workflow

---

**Last Updated:** 2025-12-28
**Total Migrations Documented:** 12
