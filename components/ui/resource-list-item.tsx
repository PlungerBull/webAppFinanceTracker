'use client';

import { ReactNode } from 'react';
import { MoreHorizontal, LucideIcon } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface DropdownAction {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    className?: string;
}

interface ResourceListItemProps {
    icon: LucideIcon;
    iconColor?: string;
    title: string;
    subtitle?: ReactNode;
    isActive: boolean;
    onClick: () => void;
    actions: DropdownAction[];
    children?: ReactNode;
}

export function ResourceListItem({
    icon: Icon,
    iconColor,
    title,
    subtitle,
    isActive,
    onClick,
    actions,
    children,
}: ResourceListItemProps) {
    return (
        <div
            className={cn(
                "relative group px-2 py-1 hover:bg-gray-50 rounded-md cursor-pointer",
                isActive && "bg-gray-50"
            )}
            onClick={onClick}
        >
            {/* Resource Header with Icon and Title */}
            <div className="flex items-center w-full text-sm text-gray-700">
                <Icon
                    className="h-4 w-4 mr-2 flex-shrink-0"
                    style={iconColor ? { color: iconColor } : undefined}
                />
                <span className="truncate flex-1">{title}</span>

                {/* Subtitle/metadata (visible by default, hidden on hover) */}
                {subtitle && (
                    <span className="text-xs text-gray-400 ml-2 group-hover:opacity-0 transition-opacity">
                        {subtitle}
                    </span>
                )}

                {/* 3-dot menu (visible on hover) */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity ml-2">
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

            {/* Children (e.g., currency balances, subcategories) */}
            {children}
        </div>
    );
}
