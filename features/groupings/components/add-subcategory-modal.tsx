'use client';

import { useState, useMemo, useEffect } from 'react';
import { useWatch } from 'react-hook-form';
import { useFormModal } from '@/lib/hooks/use-form-modal';
import { useAddSubcategory, useGroupings } from '../hooks/use-groupings';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Check, X, Pencil } from 'lucide-react';
import { GROUPING } from '@/lib/constants';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { subcategorySchema, type SubcategoryFormData } from '../schemas/grouping.schema';
import type { GroupingEntity } from '@/domain/categories';

interface AddSubcategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parentGrouping: GroupingEntity | null;
}

export function AddSubcategoryModal({ open, onOpenChange, parentGrouping }: AddSubcategoryModalProps) {
    const addSubcategoryMutation = useAddSubcategory();
    const { data: allGroupings = [] } = useGroupings();
    // Track user's manual parent selection (null means use parentGrouping prop)
    const [manualParentSelection, setManualParentSelection] = useState<GroupingEntity | null>(null);
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);

    // Derive selected parent: use manual selection if set, otherwise use prop
    const selectedParent = useMemo(() => {
        return manualParentSelection ?? parentGrouping;
    }, [manualParentSelection, parentGrouping]);

    const {
        form,
        error,
        handleClose: resetForm,
        handleSubmit,
    } = useFormModal(subcategorySchema, async (data: SubcategoryFormData) => {
        if (!selectedParent) return;

        await addSubcategoryMutation.mutateAsync({
            name: data.name,
            parentId: data.parentId,
            color: selectedParent.color, // Inherit parent color
        });
        onOpenChange(false);
    }, {
        defaultValues: {
            name: '',
            parentId: parentGrouping?.id ?? '',
        },
    });

    const {
        register,
        formState: { errors, isSubmitting },
        control,
        setValue,
    } = form;

    // Sync parentId in form when selectedParent changes
    useEffect(() => {
        if (selectedParent) {
            setValue('parentId', selectedParent.id);
        }
    }, [selectedParent, setValue]);

    const subcategoryName = useWatch({
        control,
        name: 'name',
        defaultValue: '',
    });

    const handleClose = () => {
        resetForm();
        setManualParentSelection(null); // Reset to use prop on next open
        setIsParentDropdownOpen(false);
        onOpenChange(false);
    };

    const handleParentChange = (parent: GroupingEntity) => {
        setManualParentSelection(parent);
        setIsParentDropdownOpen(false);
    };

    if (!parentGrouping) return null;

    // Get first letter for icon
    const getInitial = () => {
        return subcategoryName ? subcategoryName.charAt(0).toUpperCase() : (selectedParent?.name.charAt(0).toUpperCase() || 'S');
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
            <DialogPrimitive.Portal>
                {/* Backdrop */}
                <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">

                    {/* Modal Container */}
                    <DialogPrimitive.Content className="relative w-full max-w-md max-h-[85vh] bg-white rounded-3xl shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
                        <VisuallyHidden>
                            <DialogPrimitive.Title>New Subcategory</DialogPrimitive.Title>
                            <DialogPrimitive.Description>
                                Create a new subcategory under a parent grouping
                            </DialogPrimitive.Description>
                        </VisuallyHidden>

                        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col flex-1 overflow-hidden">
                            {/* Hero Header (Icon + Title + Close) - Fixed */}
                            <div className="px-6 pt-6 pb-5 flex items-start gap-4 shrink-0">
                                {/* Icon Anchor (Inherits parent color) */}
                                <div className="relative shrink-0">
                                    <div
                                        className="w-14 h-14 rounded-2xl ring-1 ring-black/5 flex items-center justify-center text-white text-xl font-bold drop-shadow-md"
                                        style={{ backgroundColor: selectedParent?.color || GROUPING.DEFAULT_COLOR }}
                                    >
                                        {getInitial()}
                                    </div>
                                </div>

                                {/* Title Input (Hero Text) */}
                                <div className="flex-1 relative group">
                                    <Input
                                        {...register('name')}
                                        className={cn(
                                            'text-2xl font-bold text-gray-900 border-transparent bg-transparent hover:bg-gray-50 hover:border-gray-200 focus:bg-white focus:border-blue-200 ring-0 focus:ring-0 px-4 py-2 rounded-xl transition-all',
                                            errors.name && 'border-red-300'
                                        )}
                                        placeholder="Subcategory name"
                                        autoComplete="off"
                                        autoFocus
                                    />
                                    <Pencil className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                    {errors.name && <p className="text-xs text-red-500 mt-1 px-4">{errors.name.message}</p>}
                                </div>

                                {/* Close Button (Top Right) */}
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="shrink-0 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mx-6 shrink-0" />

                            {/* Body - Scrollable */}
                            <div className="px-6 py-5 overflow-y-auto flex-1">
                                {/* Error Display */}
                                {error && (
                                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl mb-4">
                                        {error}
                                    </div>
                                )}

                                {/* Parent Selector */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-gray-500 uppercase">
                                        Parent Grouping
                                    </Label>
                                    <Popover open={isParentDropdownOpen} onOpenChange={setIsParentDropdownOpen}>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
                                            >
                                                {/* Color Indicator */}
                                                <div
                                                    className="w-4 h-4 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: selectedParent?.color || GROUPING.DEFAULT_COLOR }}
                                                />
                                                {/* Parent Name */}
                                                <span className="flex-1 text-left text-sm font-medium text-gray-800">
                                                    {selectedParent?.name || 'Select Parent'}
                                                </span>
                                                {/* Chevron */}
                                                <ChevronDown className={cn(
                                                    "w-4 h-4 text-gray-400 transition-transform",
                                                    isParentDropdownOpen && "rotate-180"
                                                )} />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent align="start" className="w-full p-2 bg-white rounded-xl shadow-xl border border-gray-100">
                                            <div className="space-y-1">
                                                {allGroupings.map((parent) => (
                                                    <button
                                                        key={parent.id}
                                                        type="button"
                                                        onClick={() => handleParentChange(parent)}
                                                        className="w-full px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 transition-colors"
                                                    >
                                                        <div
                                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: parent.color }}
                                                        />
                                                        <span className="flex-1 text-left text-sm text-gray-800">
                                                            {parent.name}
                                                        </span>
                                                        {selectedParent?.id === parent.id && (
                                                            <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <p className="text-xs text-gray-500 px-1">
                                        This subcategory will inherit the color from its parent grouping
                                    </p>
                                </div>
                            </div>

                            {/* Footer - Fixed */}
                            <div className="px-6 pb-6 pt-5 shrink-0">
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-gray-900 hover:bg-black text-white font-bold py-6 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl transition-all active:scale-[0.99]"
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Subcategory'}
                                </Button>
                            </div>
                        </form>
                    </DialogPrimitive.Content>
                </DialogPrimitive.Overlay>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
