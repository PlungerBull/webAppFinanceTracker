'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  sidebarCollapsed?: boolean;
}

export function PageHeader({ title, actions, sidebarCollapsed = false }: PageHeaderProps) {
  return (
    <div className={cn(
      'flex-shrink-0 pt-12 pb-6 bg-white dark:bg-zinc-950 transition-all duration-300',
      sidebarCollapsed ? 'px-32' : 'px-12'
    )}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          {title}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
