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
import { inboxItemViewsToTransactionViews } from '@/lib/data/data-transformers';
import type { InboxItemViewEntity } from '../domain/entities';

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

  // Transform InboxItemViewEntity to TransactionViewEntity shape for TransactionList
  // Uses centralized transformer from data-transformers.ts
  const transactions = inboxItemViewsToTransactionViews(inboxItems);

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
