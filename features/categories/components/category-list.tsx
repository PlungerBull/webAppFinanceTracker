'use client';

import { useState, useMemo } from 'react';
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
    Folder,
    CornerDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY } from '@/lib/constants';
import type { Database } from '@/types/database.types';

// Use the view type which includes transaction_count
type Category = Database['public']['Views']['categories_with_counts']['Row'];

type CategoryNode = Category & {
    children: Category[];
};

export function CategoryList() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentCategoryId = searchParams.get('categoryId');

    const { data: categories = [], isLoading } = useCategories();
    const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(true);
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
    const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Group categories into hierarchy
    const categoryTree = useMemo(() => {
        const parents: CategoryNode[] = [];
        const childrenMap = new Map<string, Category[]>();

        // First pass: identify parents and organize children
        categories.forEach(cat => {
            if (!cat.parent_id) {
                parents.push({ ...cat, children: [] });
            } else {
                const list = childrenMap.get(cat.parent_id) || [];
                list.push(cat);
                childrenMap.set(cat.parent_id, list);
            }
        });

        // Second pass: attach children to parents
        parents.forEach(parent => {
            if (parent.id) {
                parent.children = childrenMap.get(parent.id) || [];
            }
        });

        // Sort parents by name
        parents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // Sort children by name
        parents.forEach(parent => {
            parent.children.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        });

        return parents;
    }, [categories]);

    // Auto-expand parent if a child is selected
    useMemo(() => {
        if (currentCategoryId && categories.length > 0) {
            const selectedCat = categories.find(c => c.id === currentCategoryId);
            if (selectedCat?.parent_id) {
                setExpandedParents(prev => {
                    const next = new Set(prev);
                    next.add(selectedCat.parent_id!);
                    return next;
                });
            }
        }
    }, [currentCategoryId, categories]);

    const toggleParent = (parentId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedParents(prev => {
            const next = new Set(prev);
            if (next.has(parentId)) {
                next.delete(parentId);
            } else {
                next.add(parentId);
            }
            return next;
        });
    };

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

    const renderCategoryItem = (category: Category, isParent: boolean, level: number = 0) => {
        const isExpanded = category.id ? expandedParents.has(category.id) : false;
        const hasChildren = isParent && (category as CategoryNode).children.length > 0;

        return (
            <div
                key={category.id}
                className={cn(
                    "relative group px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer flex items-center justify-between",
                    currentCategoryId === category.id && "bg-zinc-100 dark:bg-zinc-800",
                    level > 0 && "ml-4"
                )}
                onClick={() => category.id && handleCategoryClick(category.id)}
            >
                {/* Category Icon and Name */}
                <div className="flex items-center gap-2 min-w-0">
                    {/* Expand/Collapse for Parents */}
                    {isParent && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 -ml-1"
                            onClick={(e) => category.id && toggleParent(category.id, e)}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-3 w-3 text-zinc-500" />
                            ) : (
                                <ChevronRight className="h-3 w-3 text-zinc-500" />
                            )}
                        </Button>
                    )}

                    {/* Indentation/Icon for Subcategories */}
                    {!isParent && (
                        <div className="w-4 flex justify-center">
                            <CornerDownRight className="h-3 w-3 text-zinc-400" />
                        </div>
                    )}

                    <div
                        className="flex items-center justify-center w-6 h-6 shrink-0"
                        style={{ color: category.color || undefined }}
                    >
                        {isParent ? <Folder className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                    </div>
                    <span className={cn(
                        "text-sm truncate text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors",
                        isParent && "font-semibold",
                        !isParent && "font-medium"
                    )}>
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
                                    <span className="sr-only">{CATEGORY.UI.LABELS.OPEN_MENU_ARIA}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={(e) => handleEdit(category, e)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    {CATEGORY.UI.LABELS.EDIT_CATEGORY}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={(e) => handleDelete(category, e)}
                                    className="text-red-600 focus:text-red-600"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {CATEGORY.UI.LABELS.DELETE_CATEGORY}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="mb-4">
                <div className="px-2 mb-2">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                        <span className="flex-1 text-left px-2 py-1 text-zinc-500 dark:text-zinc-400">
                            {CATEGORY.UI.LABELS.CATEGORIES}
                        </span>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setIsAddCategoryModalOpen(true)}
                                title={CATEGORY.UI.LABELS.ADD_CATEGORY}
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
                                {CATEGORY.UI.MESSAGES.LOADING}
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="px-2 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                {CATEGORY.UI.MESSAGES.NO_CATEGORIES}
                            </div>
                        ) : (
                            categoryTree.map((parent) => (
                                <div key={parent.id}>
                                    {renderCategoryItem(parent, true)}
                                    {parent.id && expandedParents.has(parent.id) && (
                                        <div className="mt-1 space-y-1">
                                            {parent.children.map(child => renderCategoryItem(child, false, 1))}
                                        </div>
                                    )}
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
