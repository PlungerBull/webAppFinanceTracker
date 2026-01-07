'use client';

import { ArrowRight, Save, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PanelMode, LedgerReadinessState } from './types';

interface ActionFooterProps {
  mode: PanelMode;
  onSave: () => void;
  onDelete: () => void;
  hasUnsavedChanges: boolean;
  canPromote?: boolean;  // Legacy fallback
  ledgerReadiness?: LedgerReadinessState;  // NEW: Rich readiness state
  isLoading: boolean;
}

type ButtonVariant = 'promote' | 'draft' | 'transaction';

interface ButtonState {
  disabled: boolean;
  variant: ButtonVariant;
  text: string;
  icon: typeof ArrowRight | typeof Save;
}

export function ActionFooter({
  mode,
  onSave,
  onDelete,
  hasUnsavedChanges,
  canPromote,
  ledgerReadiness,
  isLoading,
}: ActionFooterProps) {
  // Smart button state calculation
  const getButtonState = (): ButtonState => {
    // TRANSACTION MODE: Sacred Ledger Enforcement
    if (mode === 'transaction') {
      // CRITICAL: Require BOTH completeness AND unsaved changes
      // CTO Requirement: Prevent unnecessary network requests when no changes exist
      const canSave = ledgerReadiness ? (ledgerReadiness.isReady && hasUnsavedChanges) : hasUnsavedChanges;

      return {
        disabled: !canSave || isLoading,
        variant: 'transaction',
        text: 'Keep Changes',
        icon: Save,
      };
    }

    // INBOX MODE: Smart Save Logic
    if (!ledgerReadiness) {
      // Fallback to legacy behavior if readiness not provided
      return {
        disabled: !canPromote || isLoading,
        variant: 'promote',
        text: 'Promote to Ledger',
        icon: ArrowRight,
      };
    }

    if (ledgerReadiness.isReady) {
      return {
        disabled: isLoading,
        variant: 'promote',  // Blue button
        text: 'Save to Ledger',
        icon: ArrowRight,
      };
    }

    if (ledgerReadiness.canSaveDraft) {
      // Check if cross-currency without rate
      const needsRate = ledgerReadiness.missingFields.includes('exchangeRate');

      return {
        disabled: isLoading,
        variant: 'draft',  // Slate button
        text: needsRate ? 'Save Draft (Rate Required)' : 'Save Draft',
        icon: Save,
      };
    }

    // No changes made
    return {
      disabled: true,
      variant: 'draft',
      text: 'Save Draft',
      icon: Save,
    };
  };

  const buttonState = getButtonState();
  const IconComponent = buttonState.icon;

  return (
    <div className="bg-white border-t border-gray-100 px-6 py-4">
      <div className="flex flex-col gap-2">
        {/* Primary Action Button with Smart Save */}
        <Button
          onClick={onSave}
          disabled={buttonState.disabled}
          className={cn(
            'w-full text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed',
            buttonState.variant === 'promote' && 'bg-blue-600 hover:bg-blue-700 shadow-blue-100',
            buttonState.variant === 'draft' && 'bg-slate-600 hover:bg-slate-700 shadow-slate-200',
            buttonState.variant === 'transaction' && 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {buttonState.variant === 'promote' ? 'Saving...' : buttonState.variant === 'draft' ? 'Saving Draft...' : 'Saving...'}
            </>
          ) : (
            <>
              <IconComponent className="w-4 h-4 mr-2" />
              {buttonState.text}
            </>
          )}
        </Button>

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
