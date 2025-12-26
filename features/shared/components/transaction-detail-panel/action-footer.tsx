'use client';

import { ArrowRight, Save, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PanelMode } from './types';

interface ActionFooterProps {
  mode: PanelMode;
  onSave: () => void;
  onDelete: () => void;
  hasUnsavedChanges: boolean;
  canPromote: boolean;
  isLoading: boolean;
}

export function ActionFooter({
  mode,
  onSave,
  onDelete,
  hasUnsavedChanges,
  canPromote,
  isLoading,
}: ActionFooterProps) {
  return (
    <div className="bg-gray-50/30 border-t border-gray-100 px-6 py-4">
      <div className="flex flex-col gap-2">
        {/* Primary Action Button */}
        {mode === 'inbox' ? (
          <Button
            onClick={onSave}
            disabled={!canPromote || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Promoting...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                Promote to Ledger
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={onSave}
            disabled={!hasUnsavedChanges || isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Keep Changes
              </>
            )}
          </Button>
        )}

        {/* Delete Button */}
        <Button
          onClick={onDelete}
          variant="ghost"
          disabled={isLoading}
          className="text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Transaction
        </Button>
      </div>
    </div>
  );
}
