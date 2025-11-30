'use client';

import { useState, useEffect } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { useAddSubcategory, useGroupings } from '../hooks/use-groupings';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Archive, ChevronDown, Check } from 'lucide-react';
import { VALIDATION, GROUPING } from '@/lib/constants';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

type ParentCategory = Database['public']['Views']['parent_categories_with_counts']['Row'];

interface AddSubcategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parentGrouping: ParentCategory | null;
}

// Schema for the form
const subcategorySchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, GROUPING.UI.MESSAGES.SUBCATEGORY_NAME_REQUIRED),
});

type SubcategoryFormData = z.infer<typeof subcategorySchema>;

export function AddSubcategoryModal({ open, onOpenChange, parentGrouping }: AddSubcategoryModalProps) {
    const addSubcategoryMutation = useAddSubcategory();
    const { data: allGroupings = [] } = useGroupings();
    const [selectedParent, setSelectedParent] = useState<ParentCategory | null>(parentGrouping);
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);

    const {
        form,
        error,
        handleClose: resetForm,
        handleSubmit,
    } = useFormModal(subcategorySchema, async (data: SubcategoryFormData) => {
        if (!selectedParent) return;

        await addSubcategoryMutation.mutateAsync({
            name: data.name,
            parentId: selectedParent.id,
            color: selectedParent.color, // Inherit parent color
        });
        onOpenChange(false);
    }, {
        defaultValues: {
            name: '',
        },
    });

    const {
        register,
        formState: { errors, isSubmitting },
    } = form;

    const handleClose = () => {
        resetForm();
        setSelectedParent(parentGrouping);
        setIsParentDropdownOpen(false);
        onOpenChange(false);
    };

    // Reset state when modal opens or parentGrouping changes
    useEffect(() => {
        if (open && parentGrouping) {
            setSelectedParent(parentGrouping);
            setIsParentDropdownOpen(false);
        }
    }, [open, parentGrouping]);

    if (!parentGrouping) return null;

    // Get first letter for avatar
    const getInitial = (name: string) => name.charAt(0).toUpperCase();

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-sm p-0 gap-0 rounded-3xl shadow-2xl bg-white animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="flex items-center gap-2 p-4 border-b border-gray-100">
                    <div className="bg-gray-50 p-2 rounded-full">
                        <Archive className="h-4 w-4 text-gray-400" />
                    </div>
                    <DialogTitle className="text-sm font-bold text-gray-900">New Subcategory</DialogTitle>
                </div>

                {/* Body */}
                <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-6">
                    {/* Parent Context Selector */}
                    <div className="space-y-2 relative">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Parent Category
                        </label>
                        <button
                            type="button"
                            onClick={() => setIsParentDropdownOpen(!isParentDropdownOpen)}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center gap-3"
                        >
                            {/* Avatar */}
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: selectedParent?.color || GROUPING.DEFAULT_COLOR }}
                            >
                                {selectedParent ? getInitial(selectedParent.name) : '?'}
                            </div>

                            {/* Labels */}
                            <div className="flex-1 text-left">
                                <p className="text-[10px] font-bold text-gray-400 uppercase">
                                    Parent Category
                                </p>
                                <p className="text-sm font-semibold text-gray-800">
                                    {selectedParent?.name || 'Select Parent'}
                                </p>
                            </div>

                            {/* Chevron */}
                            <ChevronDown
                                className={cn(
                                    "h-4 w-4 text-gray-400 transition-transform",
                                    isParentDropdownOpen && "rotate-180"
                                )}
                            />
                        </button>

                        {/* Dropdown Menu - Outside button */}
                        {isParentDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                                <div className="py-1">
                                    {allGroupings.map((parent) => (
                                        <button
                                            key={parent.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedParent(parent);
                                                setIsParentDropdownOpen(false);
                                            }}
                                            className="w-full px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                        >
                                            {/* Color Indicator */}
                                            <div
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: parent.color }}
                                            />

                                            {/* Parent Name */}
                                            <span className="flex-1 text-left text-sm text-gray-800">
                                                {parent.name}
                                            </span>

                                            {/* Checkmark if selected */}
                                            {selectedParent?.id === parent.id && (
                                                <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Name Input */}
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-semibold text-gray-500 uppercase">
                            Subcategory Name
                        </Label>
                        <Input
                            id="name"
                            type="text"
                            placeholder="e.g. Groceries, Utility Bills"
                            {...register('name')}
                            disabled={isSubmitting}
                            autoFocus
                            className="text-lg text-gray-800 bg-gray-50 border-transparent focus:border-gray-200 focus:bg-white rounded-xl px-4 py-3 transition-all"
                        />
                        {errors.name && (
                            <p className="text-sm text-red-600">{errors.name.message as string}</p>
                        )}
                    </div>

                    {/* Inheritance Preview */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Inherits color:</span>
                        <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: selectedParent?.color || GROUPING.DEFAULT_COLOR }}
                        />
                        <span className="text-xs text-gray-400 font-mono">
                            {selectedParent?.color || GROUPING.DEFAULT_COLOR}
                        </span>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                            {error}
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="border-t border-gray-100 p-4">
                    <button
                        type="submit"
                        onClick={(e) => void handleSubmit(e)}
                        disabled={isSubmitting}
                        className="w-full bg-gray-900 text-white text-sm font-bold rounded-xl py-3 shadow-lg shadow-gray-200 hover:shadow-xl hover:bg-black active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Subcategory'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
