'use client';

import { useInboxItems } from '../hooks/use-inbox';
import { InboxCard } from './inbox-card';
import { INBOX } from '@/lib/constants';
import { Inbox as InboxIcon } from 'lucide-react';

export function InboxList() {
  const { data: items, isLoading, error } = useInboxItems();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading inbox...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-destructive">
          <p className="font-medium">Error loading inbox</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : INBOX.API.ERRORS.FETCH_FAILED}
          </p>
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <InboxIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">{INBOX.UI.MESSAGES.NO_ITEMS}</h3>
          <p className="text-sm text-muted-foreground">{INBOX.UI.MESSAGES.NO_ITEMS_DESCRIPTION}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{INBOX.UI.LABELS.PENDING_ITEMS}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? 'item' : 'items'} waiting for review
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <InboxCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
