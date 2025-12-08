'use client';

import { Pencil, Trash2, Plus, Archive } from 'lucide-react';
import { ResourceListItem } from '@/components/ui/resource-list-item';
import { GROUPING } from '@/lib/constants';
import type { ParentCategory } from '@/types/domain';

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
    const actions = [
        {
            label: GROUPING.UI.LABELS.EDIT_GROUPING,
            icon: Pencil,
            onClick: () => onEdit(grouping),
        },
        {
            label: GROUPING.UI.LABELS.CREATE_SUBCATEGORY,
            icon: Plus,
            onClick: () => onCreateSubcategory(grouping),
        },
        {
            label: GROUPING.UI.LABELS.DELETE_GROUPING,
            icon: Trash2,
            onClick: () => onDelete(grouping),
            className: 'text-red-600',
        },
    ];

    return (
        <ResourceListItem
            icon={Archive}
            iconColor={grouping.color || GROUPING.DEFAULT_COLOR}
            title={grouping.name ?? ''}
            subtitle={grouping.transaction_count || 0}
            isActive={isActive}
            onClick={onClick}
            actions={actions}
        />
    );
}
