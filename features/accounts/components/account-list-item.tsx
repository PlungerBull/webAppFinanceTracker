'use client';

import { Pencil, Trash2, CreditCard, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { ACCOUNT } from '@/lib/constants';
import type { FlatAccount } from '@/hooks/use-flat-accounts';
import type { Account } from '@/types/domain';

interface AccountListItemProps {
  account: FlatAccount;
  isActive: boolean;
  onClick: () => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}

export function AccountListItem({
  account,
  isActive,
  onClick,
  onEdit,
  onDelete,
}: AccountListItemProps) {
  const isNegative = (account.currentBalance ?? 0) < 0;

  // Convert FlatAccount to Account for edit/delete modals
  const getBankAccount = (): Account => ({
    id: account.accountId!,
    groupId: account.groupId!,
    name: account.name!,
    color: account.color!,
    currencyCode: account.currencyCode!,
    type: account.type!,
    userId: '', // Not needed by modals
    isVisible: account.isVisible ?? true,
    createdAt: account.createdAt ?? '',
    updatedAt: account.updatedAt ?? '',
  });

  const actions = [
    {
      label: 'Edit',
      icon: Pencil,
      onClick: () => onEdit(getBankAccount()),
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: () => onDelete(getBankAccount()),
      className: 'text-red-600',
    },
  ];

  return (
    <div
      className={cn(
        'group grid grid-cols-[14px_1fr_18px_auto] gap-x-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-all relative',
        'text-gray-500 dark:text-gray-400',
        'hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
        isActive && 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
      )}
      onClick={onClick}
    >
      {/* Column 1: Icon (14px) */}
      <CreditCard
        className="w-[14px] h-[14px] opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0"
        style={{ color: account.color ?? ACCOUNT.DEFAULT_COLOR }}
      />

      {/* Column 2: Account Name (1fr) */}
      <span className="text-xs font-medium truncate whitespace-nowrap">
        {account.cleanName}
      </span>

      {/* Column 3: Currency Symbol (18px) - FROM DATABASE */}
      {/* CRITICAL: Always use currencySymbol (not currencyCode) per Flat Currency Architecture */}
      <span className="text-[9px] font-bold text-right">
        {account.currencySymbol ?? account.currencyCode ?? ''}
      </span>

      {/* Column 4: Balance (auto, min-60px) */}
      <span
        className={cn(
          'text-xs font-mono tabular-nums min-w-[60px] text-right',
          isNegative && 'text-red-500'
        )}
      >
        {formatCurrency(account.currentBalance ?? 0, account.currencyCode ?? 'USD')}
      </span>

      {/* Actions Dropdown - ALWAYS RENDERED (every row gets actions) */}
      <div className="absolute right-2 top-1.5 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-xs text-zinc-500 dark:text-zinc-400 border-0 bg-transparent flex items-center justify-center outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-50">
            {actions.map((action, index) => {
              const ActionIcon = action.icon;
              return (
                <DropdownMenuItem
                  key={index}
                  className={action.className}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                >
                  <ActionIcon className="mr-2 h-4 w-4" />
                  {action.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
