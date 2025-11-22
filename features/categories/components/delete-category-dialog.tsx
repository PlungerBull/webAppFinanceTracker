'use client';

import { useDeleteItem } from '@/hooks/shared/use-delete-item';
import { categoriesApi } from '../api/categories';
import { QUERY_KEYS } from '@/lib/constants';
import { CATEGORY } from '@/lib/constants';
import type { Database } from '@/types/database.types';
import { DeleteDialog } from '@/components/shared/delete-dialog';

// Use the view type which includes transaction_count
type Category = Database['public']['Views']['categories_with_counts']['Row'];

interface DeleteCategoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: Category | null;
}

export function DeleteCategoryDialog({
    open,
    onOpenChange,
    category,
}: DeleteCategoryDialogProps) {
    const { handleDelete, isDeleting, error } = useDeleteItem(
        async (id: string) => {
            return categoriesApi.delete(id);
        },
        [QUERY_KEYS.CATEGORIES]
    );

    const onDelete = async () => {
        if (category?.id) {
            await handleDelete(category.id);
            onOpenChange(false);
        }
    };

    if (!category) return null;

    return (
        <DeleteDialog
            open={open}
            onOpenChange={onOpenChange}
            title={CATEGORY.UI.LABELS.DELETE_CATEGORY}
            description={
                <>
                    {CATEGORY.UI.MESSAGES.DELETE_CONFIRMATION}
                    <br />
                    <strong>{category.name}</strong>
                    <br />
                    <span className="text-red-500 mt-2 block">
                        {CATEGORY.UI.MESSAGES.DELETE_WARNING}
                    </span>
                    {(category.transaction_count || 0) > 0 && (
                        <span className="text-red-500 mt-1 block font-semibold">
                            {CATEGORY.UI.MESSAGES.TRANSACTION_COUNT_WARNING(category.transaction_count || 0)}
                        </span>
                    )}
                </>
            }
            onConfirm={onDelete}
            isDeleting={isDeleting}
            error={error}
            confirmLabel={CATEGORY.UI.BUTTONS.DELETE}
            cancelLabel={CATEGORY.UI.BUTTONS.CANCEL}
        />
    );
}
