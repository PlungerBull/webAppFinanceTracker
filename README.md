# WebApp Finance Tracker

A robust, personal finance management application built for data integrity and control. This app utilizes a smart Import workflow, allowing verified data to enter your records immediately while preserving a review stage for incomplete items.

## 🌟 Features

* **Zero-Latency UX:** Instant UI updates with optimistic sync architecture - edits feel immediate like Linear/Reflect
* **Dual-Platform Architecture:** Repository Pattern enables iOS Swift app with identical business logic
* **Offline-First Ready:** Soft deletes, version-based sync, and atomic transfers prepare for Todoist-style offline sync
* **Double-Entry Style Integrity:** Strict "Sacred Ledger" design pattern with integer cent arithmetic (prevents floating-point drift)
* **Smart Excel Import:** Import Excel files directly. Records containing all necessary fields are added straight to the Sacred Ledger, while incomplete data is routed to the Inbox for review
* **Multi-Currency Support:** Track accounts in different currencies with strict validation
* **Flexible Taxonomy:** Custom Categories and Groupings to organize your spending your way
* **Dashboard:** High-level financial overview and recent activity
* **Secure:** Powered by Supabase Auth and Row Level Security (RLS)

## 🛠 Tech Stack

* **Frontend:** Next.js 14 (App Router), TypeScript, React
* **UI System:** Tailwind CSS, Shadcn UI, Lucide Icons
* **Backend/DB:** Supabase (PostgreSQL, Auth, Edge Functions)
* **State Management:** TanStack Query

## 🚀 Getting Started

### Prerequisites

* Node.js 18+
* A Supabase project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/webAppFinanceTracker.git
   cd webAppFinanceTracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

### Environment Setup

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🏗️ Architecture Highlights

### Repository Pattern (Transactions Feature)

The transactions feature implements a **Todoist-style offline-first architecture** with Repository Pattern to support dual-platform development (Web + iOS).

**Key Features:**
- **Platform-Agnostic Contracts:** TypeScript interfaces mirror Swift protocols 1:1
- **Integer Cent Arithmetic:** Domain entities use integer cents (prevents floating-point drift)
- **Version-Based Sync:** Global monotonic counter (clock-independent sync)
- **Soft Deletes:** Tombstone pattern for offline sync reconciliation
- **Atomic Transfers:** Single RPC creates both OUT/IN transactions (all-or-nothing)
- **DataResult Pattern:** Explicit success/failure types (Swift-compatible)
- **Auth Abstraction:** Supports Native Apple Sign-In on iOS

**Layered Architecture:**
```
UI Components → React Query Hooks → Service Layer → Repository Layer → Database
                                         ↓                  ↓
                                   Business Logic    Data Access Only
                                   (Retry, Auth)     (Supabase/Swift)
```

**Example Usage:**
```typescript
// Use hooks for all transaction operations
import { useAddTransaction } from '@/features/transactions/hooks';

const { mutate } = useAddTransaction();
mutate({
  accountId: '...',
  amountCents: 1050,  // $10.50 as integer cents
  date: '2024-01-12T10:30:00.000Z',
  categoryId: '...',
});
```

**Status:** ✅ **Implemented** (Days 0-8 Complete, Component Migration Pending)

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md) section 6.

## 📚 Documentation Index

For more detailed information about specific aspects of the project, please refer to the following documents:

* **AI_CONTEXT.md:** Context and coding standards for AI assistants and developers (includes Repository Pattern guide in section 4H).
* **ARCHITECTURE.md:** High-level architectural overview, design patterns, and folder structure (includes Repository Pattern in section 6).
* **CHANGELOG.md:** Record of all notable changes made to the project.
* **DB_SCHEMA.md:** Detailed documentation of the database tables, relationships, and key functions.
* **TODO.md:** Project roadmap, active tasks, and known issues.
