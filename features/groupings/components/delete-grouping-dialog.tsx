'use client';

import { useState, useEffect } from 'react';
import { useDeleteGrouping, useGroupingChildren } from '../hooks/use-groupings';
import { DeleteDialog } from '@/components/shared/delete-dialog';
import { GROUPING } from '@/lib/constants';
import type { Database } from '@/types/database.types';

type ParentCategory = Database['public']['Views']['parent_categories_with_counts']['Row'];

interface DeleteGroupingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    grouping: ParentCategory | null;
}

export function DeleteGroupingDialog({ open, onOpenChange, grouping }: DeleteGroupingDialogProps) {
    const deleteGroupingMutation = useDeleteGrouping();
    const { data: children = [] } = useGroupingChildren(grouping?.id || '');
    const [error, setError] = useState<string | null>(null);

    // Reset error when dialog opens/closes or grouping changes
    useEffect(() => {
        setError(null);
    }, [open, grouping]);

    const hasChildren = children.length > 0;

    const handleDelete = async () => {
        if (!grouping) return;

        // Validation: Check if parent has children
        if (hasChildren) {
            setError(`${GROUPING.UI.MESSAGES.DELETE_BLOCKED} (${children.length} subcategories)`);
            return;
        }

        try {
            await deleteGroupingMutation.mutateAsync(grouping.id);
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete grouping');
        }
    };

    if (!grouping) return null;

    return (
        <DeleteDialog
            open={open}
            onOpenChange={onOpenChange}
            title={GROUPING.UI.LABELS.DELETE_GROUPING}
            description={
                <>
                    {hasChildren ? (
                        <div>
                            <p className="mb-2">
                                <strong className="text-red-600">{grouping.name}</strong> has {children.length} subcategory{children.length !== 1 ? 's' : ''}.
                            </p>
                            <p className="mb-2 text-red-600 font-medium">
                                {GROUPING.UI.MESSAGES.DELETE_BLOCKED}
                            </p>
                            <p className="text-sm text-gray-600">
                                Please reassign all subcategories to another parent before deleting this grouping.
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p className="mb-2">
                                {GROUPING.UI.MESSAGES.DELETE_CONFIRMATION}
                            </p>
                            <p className="mb-2">
                                <strong>{grouping.name}</strong> will be permanently deleted.
                            </p>
                            <p className="text-sm text-gray-600">
                                {GROUPING.UI.MESSAGES.DELETE_WARNING}
                            </p>
                        </div>
                    )}
                </>
            }
            onConfirm={handleDelete}
            isDeleting={deleteGroupingMutation.isPending}
            error={error}
            confirmLabel={hasChildren ? 'Cannot Delete' : GROUPING.UI.BUTTONS.DELETE}
            cancelLabel={GROUPING.UI.BUTTONS.CANCEL}
        />
    );
}
