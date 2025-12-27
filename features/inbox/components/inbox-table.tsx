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
  // Note: Converts undefined → null for TransactionView compatibility
  const transactions = inboxItems.map((item) => ({
    id: item.id,
    userId: item.userId,
    accountId: item.accountId || '',
    accountName: item.account?.name || 'Unassigned',
    accountColor: null, // Inbox items don't have account color joined yet
    amountOriginal: item.amount ?? 0,                    // Default to 0 for display
    amountHome: item.amount ?? 0,                        // Default to 0 for display
    currencyOriginal: item.currency,
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
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900">
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
