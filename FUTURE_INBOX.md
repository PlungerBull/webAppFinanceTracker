# Implementation Plan: The Implicit Inbox

**Goal:** Reduce friction for transaction entry ("Capture") while maintaining strict double-entry ledger integrity ("Process").

**Core Definition:**
* **Inbox Item:** Any transaction where `category_id` is `NULL`.
* **Holding Account:** A system-generated bank account named **"Unallocated"** that acts as the default source for quick-adds.

---

## Phase 1: Database Foundation
*Objective: Create the infrastructure to support "System Accounts" and ensure data integrity.*

### 1.1 Schema Updates
* **Modify `bank_accounts` table:**
    * Add column `is_system` (Boolean, Default: `FALSE`).
    * *Reason:* Prevents users from accidentally deleting or editing the logic-bearing "Unallocated" account.

### 1.2 Data Seeding (Migration)
* **Create the "Unallocated" Account:**
    * Write a migration script to insert a bank account for every existing user:
        * `name`: "Unallocated"
        * `is_system`: `TRUE`
        * `is_visible`: `TRUE` (or `FALSE` depending on preference, usually visible to show the negative balance).
    * **Trigger Update:** Ensure your `handle_new_user` trigger creates this account automatically for all future signups.

---

## Phase 2: Frontend Logic (Hooks)
*Objective: Create reusable logic to identify the inbox and filter data without hardcoding IDs.*

### 2.1 New Hook: `useInboxAccount`
* **Responsibility:** Locate the system account dynamically.
* **Logic:**
    * Fetch all accounts.
    * Find the one where `is_system === true` AND `name === 'Unallocated'`.
    * **Return:** `{ accountId, balance, hasWarning: balance < 0 }`.

### 2.2 Update Hook: `useTransactions`
* **Responsibility:** Fetch specific slices of data.
* **Update:** Add a `needsReview` boolean filter.
* **Query Logic:**
    * If `needsReview` is true $\rightarrow$ Fetch transactions where `category_id IS NULL`.

---

## Phase 3: The "Smart" Capture Form
*Objective: Make data entry instantaneous by making fields optional.*

### 3.1 Validation Logic
* **Relax Constraints:** Modify your Zod schema or form handler.
    * `Account`: Now Optional.
    * `Category`: Now Optional.
    * `Date`: Default to `Today`.
    * `Amount`: **Required**.

### 3.2 Submission Handler (The "Quick Add" Logic)
* **Scenario A: User fills everything**
    * Submit as normal.
* **Scenario B: User leaves Account/Category empty**
    * **Account:** Inject `inboxAccountId` (from Phase 2.1).
    * **Category:** Send `NULL`.
    * **Description:** Use user input or default to "Quick Entry".

### 3.3 UI Polish
* **Placeholders:** Update the Account dropdown placeholder to say *"Default: Unallocated"*.

---

## Phase 4: The Inbox Workflow (The Process)
*Objective: Guide the user to categorize their pending items.*

### 4.1 Dashboard "Nudge"
* **Notification Card:**
    * Check `transactions` where `category_id` is null.
    * If Count > 0, show a Dashboard card: *"You have X items to review."*
* **Balance Warning:**
    * If `Unallocated` balance is negative (e.g., -$50), show a warning: *"You have $50 in untracked spending sources."*

### 4.2 The "Needs Review" View
* **Location:** Inside `/transactions` (All Transactions Table).
* **UI:** Add a filter tab: `[All] [Needs Review] [Income]`.
* **Behavior:**
    * Clicking `[Needs Review]` activates the filter from Phase 2.2.
    * Shows transactions from "Unallocated" OR any transaction with No Category.

### 4.3 The Clearing Process
* **User Action:** Click an item in the "Needs Review" list.
* **Modal:** Opens the standard Edit Modal.
* **Resolution:**
    1.  User selects a **Real Account** (e.g., Chase).
    2.  User selects a **Category** (e.g., Food).
    3.  User saves.
* **Result:** The item disappears from the list immediately (as it no longer matches the filter).

---

## Phase 5: Future-Proofing (Social Splitting)
*Objective: Ensure this architecture supports the future "Splitwise" features.*

### 5.1 Concept Map
* **Friend = Bank Account:** Future updates will allow creating "Liability Accounts" representing friends.

### 5.2 The Workflow
* **Incoming Expense:** When a friend adds an expense (via future implementation):
    * Create Transaction.
    * `Account`: [Friend's Name].
    * `Category`: `NULL`.
* **Result:** This naturally appears in the **"Needs Review"** tab defined in Phase 4.2.
* **Resolution:** You categorize it to accept the debt, exactly like a "Quick Add" transaction.

---

## Summary of User Flow

1.  **Capture:** User taps `+`, types "50", hits Enter. (Time: 2 seconds).
2.  **Storage:** Database saves it to `Unallocated` account with `NULL` category.
3.  **Notification:** Dashboard shows "1 Item Pending".
4.  **Review:** User clicks the notification, sees the list.
5.  **Process:** User updates the transaction to "Credit Card" and "Groceries".
6.  **Completion:** Ledger is accurate, Inbox is empty.