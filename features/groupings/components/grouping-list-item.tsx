'use client';

import {
    MoreHorizontal,
    Pencil,
    Trash2,
    Plus,
    Hash,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { GROUPING } from '@/lib/constants';
import type { Database } from '@/types/database.types';

type ParentCategory = Database['public']['Views']['parent_categories_with_counts']['Row'];

interface GroupingListItemProps {
    grouping: ParentCategory;
    isActive: boolean;
    onClick: () => void;
    onEdit: (grouping: ParentCategory) => void;
    onDelete: (grouping: ParentCategory) => void;
    onCreateSubcategory: (grouping: ParentCategory) => void;
}

export function GroupingListItem({
    grouping,
    isActive,
    onClick,
    onEdit,
    onDelete,
    onCreateSubcategory,
}: GroupingListItemProps) {
    return (
        <div
            className={cn(
                "relative group px-2 py-1.5 hover:bg-gray-50 rounded-md cursor-pointer",
                isActive && "bg-gray-50"
            )}
            onClick={onClick}
        >
            {/* Grouping Header with Icon, Name, and Count */}
            <div className="flex items-center w-full text-sm text-gray-700">
                {/* Hash icon with grouping color */}
                <Hash
                    className="h-4 w-4 mr-2 flex-shrink-0"
                    style={{ color: grouping.color || GROUPING.DEFAULT_COLOR }}
                />

                {/* Grouping name */}
                <span className="truncate flex-1">{grouping.name}</span>

                {/* Transaction count (visible by default, hidden on hover) */}
                <span className="text-xs text-gray-400 ml-2 group-hover:opacity-0 transition-opacity">
                    {grouping.transaction_count || 0}
                </span>

                {/* 3-dot menu (visible on hover, replaces count) */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity ml-2 absolute right-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-xs text-zinc-500 dark:text-zinc-400 border-0 bg-transparent flex items-center justify-center outline-none"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreHorizontal className="h-3 w-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[100]">
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(grouping);
                                }}
                            >
                                <Pencil className="mr-2 h-4 w-4" />
                                {GROUPING.UI.LABELS.EDIT_GROUPING}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCreateSubcategory(grouping);
                                }}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                {GROUPING.UI.LABELS.CREATE_SUBCATEGORY}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-red-600"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(grouping);
                                }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {GROUPING.UI.LABELS.DELETE_GROUPING}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}
