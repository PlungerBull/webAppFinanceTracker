/**
 * Add Transaction Modal (Wrapper)
 *
 * Lightweight orchestrator that handles:
 * - Dialog open/close state
 * - Mode switching (transaction vs transfer)
 *
 * CTO MANDATES:
 * - Dialog Context Isolation: Only this wrapper manages Dialog
 * - Sub-modals are Content Components (no nested dialogs)
 * - No state sync between modes (tab switch = fresh start)
 *
 * Architecture:
 * ```
 * AddTransactionModal (Wrapper - OWNS Dialog Context)
 * ├── DialogPrimitive.Root, Portal, Overlay, Content
 * ├── Mode state (transaction | transfer)
 * ├── TransactionTypeTabs (reused)
 * │
 * ├── LedgerTransactionModalContent (React.memo'd)
 * │   └── State lives here, resets on unmount
 * │
 * └── TransferModalContent (React.memo'd)
 *     └── State lives here, resets on unmount
 * ```
 *
 * State Isolation:
 * - Tab switch unmounts previous component → state naturally resets
 * - No mapping transaction state → transfer state (prevents validation spaghetti)
 *
 * @module add-transaction-modal
 */

'use client';

import { useState, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import { TransactionTypeTabs } from './transaction-type-tabs';
import { LedgerTransactionModalContent } from './ledger-transaction-modal-content';
import { TransferModalContent } from './transfer-modal-content';

/**
 * Props for AddTransactionModal
 */
interface AddTransactionModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean;

  /**
   * Callback when open state changes
   */
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal mode type
 */
type ModalMode = 'transaction' | 'transfer';

/**
 * Add Transaction Modal
 *
 * Wrapper component that owns the Dialog context.
 * Content Components receive onClose callback only.
 */
export function AddTransactionModal({
  open,
  onOpenChange,
}: AddTransactionModalProps) {
  // Mode state (transaction | transfer)
  const [mode, setMode] = useState<ModalMode>('transaction');

  /**
   * Handle modal close
   *
   * Resets mode to transaction (default) when modal closes.
   * Content Component state resets automatically on unmount.
   */
  const handleClose = useCallback(() => {
    setMode('transaction');
    onOpenChange(false);
  }, [onOpenChange]);

  /**
   * Handle mode change
   *
   * Tab switch unmounts previous content → state resets naturally.
   * CTO Mandate: No state sync between modes.
   */
  const handleModeChange = useCallback((newMode: ModalMode) => {
    setMode(newMode);
  }, []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 animate-in fade-in duration-200" />

        {/* Content */}
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] outline-none animate-in fade-in zoom-in-95 duration-200">
          {/* Accessibility: Hidden title and description */}
          <VisuallyHidden>
            <DialogPrimitive.Title>
              {mode === 'transaction' ? 'Add Transaction' : 'Transfer Funds'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description>
              Form to create a new transaction or transfer funds between accounts.
            </DialogPrimitive.Description>
          </VisuallyHidden>

          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* ZONE 1: Header - Mode Switcher */}
            <div className="relative pt-6 pb-2 flex items-center justify-center shrink-0">
              <TransactionTypeTabs
                value={mode}
                onChange={handleModeChange}
                disabled={false}
              />
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ZONE 2-4: Mode-specific content */}
            {/*
              Content Components:
              - NO Dialog primitives (wrapper owns Dialog)
              - Receive onClose callback only
              - State lives inside, resets on unmount (tab switch)
              - React.memo prevents cross-component re-renders
            */}
            {mode === 'transaction' ? (
              <LedgerTransactionModalContent onClose={handleClose} />
            ) : (
              <TransferModalContent onClose={handleClose} />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
