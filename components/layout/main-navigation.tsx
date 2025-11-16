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
    <div className="space-y-1 mb-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center px-2'
              )}
            >
              <Icon className={cn('h-5 w-5', !isCollapsed && 'mr-2')} />
              {!isCollapsed && <span>{item.label}</span>}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
