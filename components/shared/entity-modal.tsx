'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';

interface EntityModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Accessible title for screen readers */
    title: string;
    /** Accessible description for screen readers */
    description?: string;
    /** Modal content (form, header, footer - all layout is controlled by children) */
    children: React.ReactNode;
    /** Max width class, defaults to max-w-md */
    maxWidth?: string;
    /** Whether to show the close button, defaults to true */
    showCloseButton?: boolean;
    /** Custom class for the content container */
    className?: string;
}

/**
 * A logic-blind modal shell that handles:
 * - Dialog open/close state
 * - Backdrop with blur
 * - Centered positioning
 * - Close button (optional)
 * - Accessibility (hidden title/description)
 * - Animations
 *
 * The children slot receives ALL content - header, body, footer, layout.
 * This allows features to define their own custom layouts while
 * keeping modal behavior centralized.
 */
export function EntityModal({
    open,
    onOpenChange,
    title,
    description,
    children,
    maxWidth = 'max-w-md',
    showCloseButton = true,
    className,
}: EntityModalProps) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                {/* Backdrop */}
                <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    {/* Modal Container */}
                    <DialogPrimitive.Content
                        className={`relative w-full ${maxWidth} max-h-[85vh] bg-white rounded-3xl shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden ${className ?? ''}`}
                    >
                        {/* Accessible labels (hidden visually) */}
                        <VisuallyHidden>
                            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
                            {description && (
                                <DialogPrimitive.Description>{description}</DialogPrimitive.Description>
                            )}
                        </VisuallyHidden>

                        {/* Close Button (absolute positioned) */}
                        {showCloseButton && (
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className="absolute top-4 right-4 z-10 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}

                        {/* Children receive full control of layout */}
                        {children}
                    </DialogPrimitive.Content>
                </DialogPrimitive.Overlay>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
