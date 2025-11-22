'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCategories } from '../hooks/use-categories';
import { AddCategoryModal } from './add-category-modal';
import { EditCategoryModal } from './edit-category-modal';
import { DeleteCategoryDialog } from './delete-category-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Plus,
    ChevronDown,
    MoreHorizontal,
    Pencil,
    Trash2,
    ChevronRight,
    Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

// Use the view type which includes transaction_count
type Category = Database['public']['Views']['categories_with_counts']['Row'];

export function CategoryList() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentCategoryId = searchParams.get('categoryId');

    const { data: categories = [], isLoading } = useCategories();
    const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(true);
    const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const handleCategoryClick = (categoryId: string) => {
        const params = new URLSearchParams(searchParams.toString());

        // Toggle selection: if already selected, remove filter
        if (currentCategoryId === categoryId) {
            params.delete('categoryId');
        } else {
            params.set('categoryId', categoryId);
            // Clear account filter when selecting a category (mutually exclusive)
            params.delete('account');
        }

        // Reset page if pagination exists (optional, good practice)
        params.delete('page');

        router.push(`/transactions?${params.toString()}`);
    };

    const handleEdit = (category: Category, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCategory(category);
    };

    const handleDelete = (category: Category, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingCategory(category);
    };

    return (
        <>
            <div className="mb-4">
                <div className="px-2 mb-2">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                        <span className="flex-1 text-left px-2 py-1 text-zinc-500 dark:text-zinc-400">
                            Categories
                        </span>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setIsAddCategoryModalOpen(true)}
                                title="Add Category"
                            >
                                <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
                            >
                                {isCategoriesExpanded ? (
                                    <ChevronDown className="h-3 w-3" />
                                ) : (
                                    <ChevronRight className="h-3 w-3" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {isCategoriesExpanded && (
                    <div className="space-y-1">
                        {isLoading ? (
                            <div className="px-2 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                Loading...
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="px-2 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                No categories yet!
                            </div>
                        ) : (
                            categories.map((category) => (
                                <div
                                    key={category.id}
                                    className={cn(
                                        "relative group px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer flex items-center justify-between",
                                        currentCategoryId === category.id && "bg-zinc-100 dark:bg-zinc-800"
                                    )}
                                    onClick={() => handleCategoryClick(category.id)}
                                >
                                    {/* Category Icon and Name */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className="flex items-center justify-center w-8 h-8 shrink-0"
                                            style={{ color: category.color }}
                                        >
                                            <Hash className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium truncate text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                                            {category.name}
                                        </span>
                                    </div>

                                    <div className="flex items-center">
                                        {/* Transaction Count - Visible by default, hidden on hover or when menu is open */}
                                        <span className={cn(
                                            "text-xs text-zinc-500 font-medium px-2",
                                            openMenuId === category.id ? "hidden" : "group-hover:hidden"
                                        )}>
                                            {category.transaction_count}
                                        </span>

                                        {/* Actions Menu - Hidden by default, visible on hover or when menu is open */}
                                        <div className={cn(
                                            openMenuId === category.id ? "block" : "hidden group-hover:block"
                                        )}>
                                            <DropdownMenu
                                                open={openMenuId === category.id}
                                                onOpenChange={(open) => setOpenMenuId(open ? category.id : null)}
                                            >
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 p-0 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MoreHorizontal className="h-4 w-4 text-zinc-500" />
                                                        <span className="sr-only">Open menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem onClick={(e) => handleEdit(category, e)}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={(e) => handleDelete(category, e)}
                                                        className="text-red-600 focus:text-red-600"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <AddCategoryModal
                open={isAddCategoryModalOpen}
                onOpenChange={setIsAddCategoryModalOpen}
            />

            <EditCategoryModal
                open={!!editingCategory}
                onOpenChange={(open) => !open && setEditingCategory(null)}
                category={editingCategory}
            />

            <DeleteCategoryDialog
                open={!!deletingCategory}
                onOpenChange={(open) => !open && setDeletingCategory(null)}
                category={deletingCategory}
            />
        </>
    );
}
