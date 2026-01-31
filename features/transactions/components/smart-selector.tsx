'use client';

import { type LucideIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SmartSelectorProps {
  icon: LucideIcon;
  label: string;
  value?: string;
  placeholder?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  required?: boolean;
  error?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SmartSelector({
  icon: Icon,
  label,
  value,
  placeholder,
  isOpen,
  onOpenChange,
  // required - intentionally not destructured (not yet implemented in UI)
  error = false,
  children,
  className,
}: SmartSelectorProps) {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
            value
              ? "bg-gray-50 border-gray-300 text-gray-900"
              : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
            isOpen && "ring-2 ring-blue-200 border-blue-300",
            error && "border-red-300 ring-2 ring-red-100",
            className
          )}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium truncate">
            {value || placeholder || label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {children}
      </PopoverContent>
    </Popover>
  );
}
