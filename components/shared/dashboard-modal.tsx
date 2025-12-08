/**
 * Dashboard Modal - Compound Component Pattern
 *
 * Single source of truth for all Dashboard Card modal patterns.
 * Handles state, animations, scrolling behavior, and accessibility automatically.
 *
 * WHY: Eliminates duplication across all modals. If we change modal behavior
 * (e.g., add closing animation, haptic feedback), we only change it here.
 *
 * USAGE:
 * <DashboardModal open={open} onOpenChange={setOpen}>
 *   <DashboardModal.Header>
 *     <DashboardModal.Icon color={color}>{initial}</DashboardModal.Icon>
 *     <DashboardModal.Title>{name}</DashboardModal.Title>
 *     <DashboardModal.Meta>Extra controls here</DashboardModal.Meta>
 *   </DashboardModal.Header>
 *   <DashboardModal.Body>Content here</DashboardModal.Body>
 *   <DashboardModal.Footer>
 *     <Button>Save</Button>
 *   </DashboardModal.Footer>
 * </DashboardModal>
 */

'use client';

import { createContext, useContext, forwardRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// CONTEXT
// ============================================================================

interface DashboardModalContextValue {
  onClose: () => void;
  isOpen: boolean;
}

const DashboardModalContext = createContext<DashboardModalContextValue | null>(null);

function useDashboardModal() {
  const context = useContext(DashboardModalContext);
  if (!context) {
    throw new Error('Dashboard Modal compound components must be used within DashboardModal');
  }
  return context;
}

// ============================================================================
// ROOT COMPONENT
// ============================================================================

interface DashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  maxWidth?: string;
}

function DashboardModalRoot({
  open,
  onOpenChange,
  children,
  title = 'Modal',
  description,
  maxWidth = 'max-w-md',
}: DashboardModalProps) {
  const handleClose = () => onOpenChange(false);

  const contextValue: DashboardModalContextValue = {
    onClose: handleClose,
    isOpen: open,
  };

  return (
    <DashboardModalContext.Provider value={contextValue}>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          {/* Backdrop - Centered, no scroll */}
          <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Modal Container - Internal scrolling */}
            <DialogPrimitive.Content
              className={cn(
                'relative w-full max-h-[85vh] bg-white rounded-3xl shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden',
                maxWidth
              )}
            >
              {/* Accessibility */}
              <VisuallyHidden>
                <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description>{description}</DialogPrimitive.Description>
                )}
              </VisuallyHidden>

              {children}
            </DialogPrimitive.Content>
          </DialogPrimitive.Overlay>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </DashboardModalContext.Provider>
  );
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

interface HeaderProps {
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

function Header({ children, className, showCloseButton = true }: HeaderProps) {
  const { onClose } = useDashboardModal();

  return (
    <div className={cn('px-6 pt-6 pb-5 flex items-start gap-4 shrink-0', className)}>
      {children}
      {showCloseButton && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-auto"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// ICON COMPONENT
// ============================================================================

interface IconProps {
  children: React.ReactNode;
  color: string;
  className?: string;
}

function Icon({ children, color, className }: IconProps) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          'w-14 h-14 rounded-2xl ring-1 ring-black/5 flex items-center justify-center text-white text-xl font-bold drop-shadow-md',
          className
        )}
        style={{ backgroundColor: color }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// TITLE COMPONENT
// ============================================================================

interface TitleProps {
  children: React.ReactNode;
  className?: string;
}

const Title = forwardRef<HTMLDivElement, TitleProps>(
  ({ children, className }, ref) => {
    return (
      <div ref={ref} className={cn('flex-1 relative', className)}>
        {children}
      </div>
    );
  }
);
Title.displayName = 'DashboardModal.Title';

// ============================================================================
// META COMPONENT (for top-right controls like toggles)
// ============================================================================

interface MetaProps {
  children: React.ReactNode;
  className?: string;
}

function Meta({ children, className }: MetaProps) {
  return (
    <div className={cn('shrink-0 flex items-center gap-2', className)}>
      {children}
    </div>
  );
}

// ============================================================================
// DIVIDER COMPONENT
// ============================================================================

interface DividerProps {
  className?: string;
}

function Divider({ className }: DividerProps) {
  return (
    <div
      className={cn(
        'h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mx-6 shrink-0',
        className
      )}
    />
  );
}

// ============================================================================
// BODY COMPONENT (Scrollable)
// ============================================================================

interface BodyProps {
  children: React.ReactNode;
  className?: string;
}

function Body({ children, className }: BodyProps) {
  return (
    <div className={cn('px-6 py-5 overflow-y-auto flex-1', className)}>
      {children}
    </div>
  );
}

// ============================================================================
// FOOTER COMPONENT (Fixed)
// ============================================================================

interface FooterProps {
  children: React.ReactNode;
  className?: string;
}

function Footer({ children, className }: FooterProps) {
  return (
    <div className={cn('px-6 pb-6 pt-5 shrink-0', className)}>
      {children}
    </div>
  );
}

// ============================================================================
// ERROR DISPLAY COMPONENT
// ============================================================================

interface ErrorProps {
  error: string | null | undefined;
  className?: string;
}

function ErrorDisplay({ error, className }: ErrorProps) {
  if (!error) return null;

  return (
    <div className={cn('p-3 text-sm text-red-600 bg-red-50 rounded-xl', className)}>
      {error}
    </div>
  );
}

// ============================================================================
// FORM WRAPPER COMPONENT
// ============================================================================

interface FormProps {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  className?: string;
}

function Form({ children, onSubmit, className }: FormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit(e);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex flex-col flex-1 overflow-hidden', className)}
    >
      {children}
    </form>
  );
}

// ============================================================================
// EXPORTS - Compound Component Pattern
// ============================================================================

export const DashboardModal = Object.assign(DashboardModalRoot, {
  Header,
  Icon,
  Title,
  Meta,
  Divider,
  Body,
  Footer,
  Error: ErrorDisplay,
  Form,
});
