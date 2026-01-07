Simple Expense Tracker

CTO's Note: This is the entry point. For technical details, see CONTEXT_AI.md.

1. Project Overview

Simple Expense Tracker is a beautiful, high-performance personal finance application. It is designed to feel like a "companion" rather than a spreadsheet, prioritizing warmth, speed, and offline capabilities.

2. Quick Start

Follow these steps to get the application running locally in under 2 minutes.

1. Install Dependencies

# We use npm ci to ensure strictly versioned installs from package-lock.json
npm ci


2. Configure Environment

Create your local environment file.

cp .env.example .env.local


You must populate NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.

3. Run the Server

npm run dev


Access the app at http://localhost:3000.

3. Prerequisites

Node.js: v20.x or higher (Required for Next.js 16).

Supabase: A running project (Cloud or Local).

4. Documentation Index

CONTEXT_AI.md: The technical manual. Stack, Schema, and Architecture.

PRD.md: The Product Vision. What we are building and why.

AI_RULES.md: The "Constitution". Rules for coding and maintaining this repo.

TODO.md: The Roadmap. What is done and what is pending.