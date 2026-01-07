'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { InboxDetailPanel } from './inbox-detail-panel';
import { useInboxItems } from '../hooks/use-inbox';
import type { InboxItem } from '../types';

function InboxContent() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const { data: inboxItems = [], isLoading } = useInboxItems();

  // Transform InboxItem to match TransactionRow shape expected by TransactionList
  // NULL-SAFE: Handle partial drafts with missing amount/description
  // Preserve null state for amounts (don't convert to 0) to show "--" placeholder in list
  const transactions = inboxItems.map((item) => ({
    id: item.id,
    userId: item.userId,
    accountId: item.accountId || '',                     // Empty string for missing account
    accountName: item.account?.name || 'Unassigned',
    accountColor: null, // Inbox items don't have account color joined yet
    amountOriginal: item.amountOriginal ?? null,         // Preserve null for draft state (RENAMED)
    amountHome: item.amountOriginal ?? null,             // Preserve null for draft state (RENAMED)
    currencyOriginal: item.currencyOriginal || '',       // Empty string when no currency (RENAMED)
    exchangeRate: item.exchangeRate ?? 1.0,
    date: item.date || new Date().toISOString(),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    categoryId: item.categoryId ?? null,                 // undefined → null
    categoryName: item.category?.name ?? null,
    categoryColor: item.category?.color ?? null,
    description: item.description ?? '—',               // Show dash if undefined
    notes: null,
  }));

  const selectedItem = selectedItemId
    ? inboxItems.find((item) => item.id === selectedItemId) || null
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-900">
      {/* Section 1: Sidebar */}
      <Sidebar />

      {/* Section 2: Inbox List */}
      <TransactionList
        transactions={transactions}
        isLoading={isLoading}
        selectedTransactionId={selectedItemId}
        onTransactionSelect={setSelectedItemId}
        title="Inbox"
        variant="default"
      />

      {/* Section 3: Inbox Details Panel */}
      <InboxDetailPanel item={selectedItem} />
    </div>
  );
}

export function InboxTable() {
  return (
    <SidebarProvider>
      <InboxContent />
    </SidebarProvider>
  );
}
