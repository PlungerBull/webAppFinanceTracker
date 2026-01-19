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
  const {
    data: inboxItems,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    totalCount,
  } = useInboxItems();

  // Transform InboxItem to match TransactionViewEntity shape expected by TransactionList
  // NULL-SAFE: Handle partial drafts with missing amount/description
  // INTEGER CENTS: Convert decimal amounts to integer cents (Repository Pattern)
  const transactions = inboxItems.map((item) => ({
    id: item.id,
    version: 1, // Inbox drafts initialize at version 1
    userId: item.userId,
    accountId: item.accountId || '',
    accountName: item.account?.name || 'Unassigned',
    accountColor: null, // Inbox items don't have account color joined yet
    accountCurrency: item.currencyOriginal || 'USD', // Currency from account
    // INTEGER CENTS: Already in integer cents from domain
    amountCents: item.amountCents ?? 0,
    amountHomeCents: item.amountCents ?? 0,
    currencyOriginal: item.currencyOriginal || '',
    exchangeRate: item.exchangeRate ?? 1.0,
    date: item.date || new Date().toISOString(),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: null, // Inbox items are never soft-deleted
    categoryId: item.categoryId ?? null,
    categoryName: item.category?.name ?? null,
    categoryColor: item.category?.color ?? null,
    categoryType: null, // Inbox items don't have type yet
    transferId: null, // Inbox items are never transfers
    description: item.description ?? '—', // Show dash if undefined
    notes: null,
    reconciliationId: null, // Inbox items aren't reconciled yet
    cleared: false, // Inbox items aren't cleared
    reconciliationStatus: null, // Inbox items aren't reconciled yet
  }));

  const selectedItem = selectedItemId
    ? inboxItems.find((item) => item.id === selectedItemId) || null
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-900">
      {/* Section 1: Sidebar */}
      <Sidebar />

      {/* Section 2: Inbox List (Virtualized with Infinite Scroll) */}
      <TransactionList
        transactions={transactions}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        selectedTransactionId={selectedItemId}
        onTransactionSelect={setSelectedItemId}
        title="Inbox"
        totalCount={totalCount}
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
