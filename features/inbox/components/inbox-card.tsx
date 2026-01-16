'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { CategorySelector } from '@/features/transactions/components/category-selector';
import { usePromoteInboxItem, useDismissInboxItem, useUpdateInboxDraft } from '../hooks/use-inbox';
import { INBOX } from '@/lib/constants';
import { toast } from 'sonner';
import type { InboxItem } from '../types';
import { Check, X, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface InboxCardProps {
  item: InboxItem;
}

export function InboxCard({ item }: InboxCardProps) {
  // FIX: Initialize state with existing data (prevents "amnesia" bug)
  const [selectedAccountId, setSelectedAccountId] = useState<string>(item.accountId || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(item.categoryId || '');
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);

  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const promoteItem = usePromoteInboxItem();
  const dismissItem = useDismissInboxItem();
  const updateDraft = useUpdateInboxDraft();

  const canApprove = selectedAccountId && selectedCategoryId;

  // FIX: Auto-save account selection (prevents "lost work" bug)
  const handleAccountChange = async (accountId: string) => {
    setSelectedAccountId(accountId);

    try {
      await updateDraft.mutateAsync({
        id: item.id,
        updates: { accountId },
      });
    } catch (error) {
      console.error('Failed to save account selection:', error);
      // Silent fail - user can still proceed, will be saved on promote
    }
  };

  // FIX: Auto-save category selection (prevents "lost work" bug)
  const handleCategoryChange = async (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setIsCategoryPopoverOpen(false);

    try {
      await updateDraft.mutateAsync({
        id: item.id,
        updates: { categoryId },
      });
    } catch (error) {
      console.error('Failed to save category selection:', error);
      // Silent fail - user can still proceed, will be saved on promote
    }
  };

  const handleApprove = async () => {
    if (!canApprove) return;

    try {
      await promoteItem.mutateAsync({
        inboxId: item.id,
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
      });
      toast.success(INBOX.UI.MESSAGES.PROMOTE_SUCCESS);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : INBOX.API.ERRORS.PROMOTE_FAILED);
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissItem.mutateAsync(item.id);
      toast.success(INBOX.UI.MESSAGES.DISMISS_SUCCESS);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : INBOX.API.ERRORS.DISMISS_FAILED);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Transaction Details - NULL-SAFE RENDERING */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-medium text-lg">
                {item.description || <span className="text-muted-foreground">—</span>}
              </p>
              {item.date && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(item.date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg">
                {item.amountOriginal !== undefined ? (
                  <>
                    {item.amountOriginal > 0 ? '+' : ''}
                    {item.amountOriginal.toFixed(2)} {item.currencyOriginal}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
            </div>
          </div>

          {/* Source Text (if available) */}
          {item.sourceText && (
            <div className="bg-muted/50 rounded-md p-2">
              <p className="text-xs text-muted-foreground font-mono">{item.sourceText}</p>
            </div>
          )}

          {/* Account Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{INBOX.UI.LABELS.ACCOUNT}</label>
            <Select
              value={selectedAccountId}
              onValueChange={handleAccountChange}
              disabled={accountsLoading || promoteItem.isPending || updateDraft.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={INBOX.UI.LABELS.SELECT_ACCOUNT} />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id || ''}>
                    {account.name} ({account.currencyCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{INBOX.UI.LABELS.CATEGORY}</label>
            <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-between',
                    !selectedCategoryId && 'text-muted-foreground'
                  )}
                  disabled={promoteItem.isPending || updateDraft.isPending}
                >
                  {selectedCategoryId ? 'Category Selected' : INBOX.UI.LABELS.SELECT_CATEGORY}
                  <Check className={cn('ml-2 h-4 w-4', !selectedCategoryId && 'opacity-0')} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <CategorySelector
                  value={selectedCategoryId}
                  onChange={handleCategoryChange}
                  disabled={promoteItem.isPending || updateDraft.isPending}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 justify-end border-t pt-4">
        <Button
          variant="outline"
          onClick={handleDismiss}
          disabled={dismissItem.isPending || promoteItem.isPending}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          {dismissItem.isPending ? INBOX.UI.BUTTONS.IGNORING : INBOX.UI.BUTTONS.IGNORE}
        </Button>
        <Button
          onClick={handleApprove}
          disabled={!canApprove || promoteItem.isPending || dismissItem.isPending}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          {promoteItem.isPending ? INBOX.UI.BUTTONS.APPROVING : INBOX.UI.BUTTONS.APPROVE}
        </Button>
      </CardFooter>
    </Card>
  );
}
