'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    onSubmit: (e: React.FormEvent) => Promise<void> | void;
    isSubmitting: boolean;
    submitLabel: string;
    cancelLabel?: string;
    error?: string | null;
    maxWidth?: string;
}

export function FormModal({
    open,
    onOpenChange,
    title,
    description,
    children,
    onSubmit,
    isSubmitting,
    submitLabel,
    cancelLabel = 'Cancel',
    error,
    maxWidth = 'sm:max-w-[425px]',
}: FormModalProps) {
    const handleClose = () => {
        if (!isSubmitting) {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className={cn(maxWidth, "max-h-[90vh] overflow-y-auto")}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                <form onSubmit={onSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                            {error}
                        </div>
                    )}

                    {children}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            {cancelLabel}
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {submitLabel}...
                                </>
                            ) : (
                                submitLabel
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
