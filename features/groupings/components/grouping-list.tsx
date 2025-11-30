'use client';

import { useState } from 'react';
import { useGroupings } from '../hooks/use-groupings';
import { useGroupingNavigation } from '../hooks/use-grouping-navigation';
import { AddGroupingModal } from './add-grouping-modal';
import { EditGroupingModal } from './edit-grouping-modal';
import { DeleteGroupingDialog } from './delete-grouping-dialog';
import { AddSubcategoryModal } from './add-subcategory-modal';
import { Button } from '@/components/ui/button';
import { GroupingListItem } from './grouping-list-item';
import {
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { GROUPING } from '@/lib/constants';
import type { Database } from '@/types/database.types';

type ParentCategory = Database['public']['Views']['parent_categories_with_counts']['Row'];

export function GroupingList() {
  const { data: groupings = [], isLoading } = useGroupings();
  const { handleGroupingClick, currentGroupingId } = useGroupingNavigation();
  const [isGroupingsExpanded, setIsGroupingsExpanded] = useState(true);
  const [isAddGroupingModalOpen, setIsAddGroupingModalOpen] = useState(false);
  const [editingGrouping, setEditingGrouping] = useState<ParentCategory | null>(null);
  const [deletingGrouping, setDeletingGrouping] = useState<ParentCategory | null>(null);
  const [subcategoryParent, setSubcategoryParent] = useState<ParentCategory | null>(null);

  return (
    <>
      <div className="mb-4">
        <div className="px-3 mb-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
            <span className="flex-1 text-left px-2 py-1 text-gray-400">
              {GROUPING.UI.LABELS.GROUPINGS}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsAddGroupingModalOpen(true)}
                title={GROUPING.UI.LABELS.ADD_GROUPING}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsGroupingsExpanded(!isGroupingsExpanded)}
              >
                {isGroupingsExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {isGroupingsExpanded && (
          <div className="space-y-1">
            {isLoading ? (
              <div className="px-2 py-4 text-center text-sm text-gray-400">
                {GROUPING.UI.MESSAGES.LOADING}
              </div>
            ) : groupings.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-gray-400">
                {GROUPING.UI.MESSAGES.NO_GROUPINGS}
              </div>
            ) : (
              groupings.map((grouping) => (
                <GroupingListItem
                  key={grouping.id}
                  grouping={grouping}
                  isActive={currentGroupingId === grouping.id}
                  onClick={() => handleGroupingClick(grouping.id)}
                  onEdit={setEditingGrouping}
                  onDelete={setDeletingGrouping}
                  onCreateSubcategory={setSubcategoryParent}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddGroupingModal
        open={isAddGroupingModalOpen}
        onOpenChange={setIsAddGroupingModalOpen}
      />

      <EditGroupingModal
        open={!!editingGrouping}
        onOpenChange={(open) => !open && setEditingGrouping(null)}
        grouping={editingGrouping}
      />

      <DeleteGroupingDialog
        open={!!deletingGrouping}
        onOpenChange={(open) => !open && setDeletingGrouping(null)}
        grouping={deletingGrouping}
      />

      <AddSubcategoryModal
        open={!!subcategoryParent}
        onOpenChange={(open) => !open && setSubcategoryParent(null)}
        parentGrouping={subcategoryParent}
      />
    </>
  );
}
