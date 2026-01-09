'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeftRight, Inbox, FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainNavigationProps {
  isCollapsed: boolean;
}

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/reconciliations', label: 'Reconciliations', icon: FileCheck },
];

export function MainNavigation({ isCollapsed }: MainNavigationProps) {
  const pathname = usePathname();

  return (
    <div className="px-2 space-y-1 mb-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Button
            key={item.href}
            variant="ghost"
            asChild
            className={cn(
              'w-full justify-start px-3 py-2 gap-3',
              isCollapsed && 'justify-center px-2',
              isActive ? 'bg-white text-gray-900 font-medium border border-gray-200' : 'text-gray-600 hover:bg-white hover:border hover:border-gray-200'
            )}
          >
            <Link href={item.href}>
              <Icon className="h-[18px] w-[18px]" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
