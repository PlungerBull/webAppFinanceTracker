'use client';

import { useState } from 'react';
import { useDeleteGrouping, useGroupingChildren } from '../hooks/use-groupings';
import { DeleteDialog } from '@/components/shared/delete-dialog';
import { GROUPING } from '@/lib/constants';
import type { GroupingEntity } from '@/domain/categories';

interface DeleteGroupingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    grouping: GroupingEntity | null;
}

/**
 * Inner component that handles the actual dialog logic.
 * Re-mounts when grouping changes (via key prop from parent).
 */
function DeleteGroupingDialogInner({ open, onOpenChange, grouping }: DeleteGroupingDialogProps) {
    const deleteGroupingMutation = useDeleteGrouping();
    const { data: children = [] } = useGroupingChildren(grouping?.id || '');
    const [error, setError] = useState<string | null>(null);

    const hasChildren = children.length > 0;

    const handleDelete = async () => {
        if (!grouping) return;

        // Validation: Check if parent has children
        if (hasChildren) {
            setError(`${GROUPING.UI.MESSAGES.DELETE_BLOCKED} (${children.length} subcategories)`);
            return;
        }

        try {
            await deleteGroupingMutation.mutateAsync({ id: grouping.id, version: grouping.version });
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

/**
 * Wrapper component that resets inner state when grouping changes.
 * Uses key prop to force remount when a different grouping is selected.
 */
export function DeleteGroupingDialog({ open, onOpenChange, grouping }: DeleteGroupingDialogProps) {
    // Key-based remount: when grouping changes, inner component remounts with fresh state
    return (
        <DeleteGroupingDialogInner
            key={grouping?.id ?? 'none'}
            open={open}
            onOpenChange={onOpenChange}
            grouping={grouping}
        />
    );
}
