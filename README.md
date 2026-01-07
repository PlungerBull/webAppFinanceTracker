# WebApp Finance Tracker

A robust, personal finance management application built for data integrity and control. This app utilizes a smart Import workflow, allowing verified data to enter your records immediately while preserving a review stage for incomplete items.

## 🌟 Features

* **Double-Entry Style Integrity:** Strict "Sacred Ledger" design pattern.
* **Smart Excel Import:** Import Excel files directly. Records containing all necessary fields are added straight to the Sacred Ledger, while incomplete data is routed to the Inbox for review.
* **Multi-Currency Support:** Track accounts in different currencies with strict validation.
* **Flexible Taxonomy:** Custom Categories and Groupings to organize your spending your way.
* **Dashboard:** High-level financial overview and recent activity.
* **Secure:** Powered by Supabase Auth and Row Level Security (RLS).

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

## 📚 Documentation Index

For more detailed information about specific aspects of the project, please refer to the following documents:

* **AI_CONTEXT.md:** Context and coding standards for AI assistants and developers.
* **ARCHITECTURE.md:** High-level architectural overview, design patterns, and folder structure.
* **CHANGELOG.md:** Record of all notable changes made to the project.
* **DB_SCHEMA.md:** Detailed documentation of the database tables, relationships, and key functions.
* **TODO.md:** Project roadmap, active tasks, and known issues.
