'use client';

/**
 * InboxTable Component
 *
 * CTO MANDATE: "Inbox is not a Special Case - it follows the same table rules."
 * Uses useBulkSelection for unified selection behavior with AllTransactionsTable.
 *
 * @module inbox-table
 */

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { InboxDetailPanel } from './inbox-detail-panel';
import { useInboxItems } from '../hooks/use-inbox';
import { useBulkSelection } from '@/features/transactions/hooks/use-bulk-selection';
import type { InboxItemViewEntity } from '../domain/entities';
import type { TransactionViewEntity } from '@/features/transactions/domain/entities';

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

  // Transform InboxItemViewEntity to match TransactionViewEntity shape expected by TransactionList
  // NULL-SAFE: Handle partial drafts with missing amount/description
  // INTEGER CENTS: Convert decimal amounts to integer cents (Repository Pattern)
  const transactions: TransactionViewEntity[] = inboxItems.map((item: InboxItemViewEntity) => ({
    id: item.id,
    version: item.version ?? 1, // Inbox drafts initialize at version 1
    userId: item.userId,
    accountId: item.accountId ?? '',
    accountName: item.account?.name ?? 'Unassigned',
    accountColor: null, // Inbox items don't have account color joined yet
    accountCurrency: item.currencyCode ?? 'USD', // Currency from account
    // INTEGER CENTS: Already in integer cents from domain
    amountCents: item.amountCents ?? 0,
    amountHomeCents: item.amountCents ?? 0,
    currencyOriginal: item.currencyCode ?? '',
    exchangeRate: item.exchangeRate ?? 1.0,
    date: item.date ?? new Date().toISOString(),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: null, // Inbox items are never soft-deleted
    categoryId: item.categoryId,
    categoryName: item.category?.name ?? null,
    categoryColor: item.category?.color ?? null,
    categoryType: null, // Inbox items don't have type yet
    transferId: null, // Inbox items are never transfers
    description: item.description ?? '—', // Show dash if null
    notes: item.notes ?? null,
    reconciliationId: null, // Inbox items aren't reconciled yet
    cleared: false, // Inbox items aren't cleared
    reconciliationStatus: null, // Inbox items aren't reconciled yet
  }));

  // === Bulk Selection (Domain Hook) ===
  // CTO MANDATE: Inbox uses the same selection rules as Transactions
  const bulk = useBulkSelection({
    transactions,
    onFocusTransaction: setSelectedItemId,
  });

  const selectedItem = selectedItemId
    ? inboxItems.find((item: InboxItemViewEntity) => item.id === selectedItemId) ?? null
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-900">
      {/* Section 1: Sidebar */}
      <Sidebar />

      {/* Section 2: Inbox List (Virtualized with Infinite Scroll) */}
      {/* CTO MANDATE: Uses unified selection props, no "Mode 2" fallback */}
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
        // Bulk Selection Props (unified with AllTransactionsTable)
        isBulkMode={bulk.isBulkMode}
        selectedIds={bulk.selectedIds}
        onToggleBulkMode={bulk.handleToggleBulkMode}
        onToggleSelection={bulk.handleToggleSelection}
        onEnterBulkMode={bulk.enterBulkMode}
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
