'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainNavigationProps {
  isCollapsed: boolean;
}

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
];

export function MainNavigation({ isCollapsed }: MainNavigationProps) {
  const pathname = usePathname();

  return (
    <div className="px-2 space-y-1 mb-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start px-3 py-2 gap-3',
                isCollapsed && 'justify-center px-2',
                isActive ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {!isCollapsed && <span>{item.label}</span>}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
