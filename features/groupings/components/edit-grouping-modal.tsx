'use client';

import { useState, useEffect } from 'react';
import { useFormModal } from '@/hooks/shared/use-form-modal';
import { z } from 'zod';
import { useUpdateGrouping, useGroupingChildren, useGroupings, useReassignSubcategory } from '../hooks/use-groupings';
import { Input } from '@/components/ui/input';
import { Pencil, ChevronDown, Check, FolderOpen, Square, CheckSquare } from 'lucide-react';
import { ACCOUNT, VALIDATION, GROUPING } from '@/lib/constants';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

type ParentCategory = Database['public']['Views']['parent_categories_with_counts']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

interface EditGroupingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    grouping: ParentCategory | null;
}

// Schema for the form
const groupingSchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, GROUPING.UI.MESSAGES.GROUPING_NAME_REQUIRED),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, 'Invalid color format'),
});

type GroupingFormData = z.infer<typeof groupingSchema>;

// Predefined color palette
const COLOR_PALETTE = [
    '#FB923C', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#EF4444', '#6B7280', '#14B8A6', '#F43F5E',
];

export function EditGroupingModal({ open, onOpenChange, grouping }: EditGroupingModalProps) {
    const updateGroupingMutation = useUpdateGrouping();
    const reassignSubcategoryMutation = useReassignSubcategory();
    const { data: allGroupings = [] } = useGroupings();
    const { data: children = [] } = useGroupingChildren(grouping?.id || '');

    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
    const [targetParentId, setTargetParentId] = useState<string>('');
    const [isSubcategoriesOpen, setIsSubcategoriesOpen] = useState(false);
    const [isTargetParentOpen, setIsTargetParentOpen] = useState(false);
    const [reassigning, setReassigning] = useState(false);

    const {
        form,
        error,
        handleClose: resetForm,
        handleSubmit,
    } = useFormModal(groupingSchema, async (data: GroupingFormData) => {
        if (!grouping) return;

        await updateGroupingMutation.mutateAsync({
            id: grouping.id,
            data: {
                name: data.name,
                color: data.color,
            },
        });
        onOpenChange(false);
    }, {
        defaultValues: {
            name: grouping?.name || '',
            color: grouping?.color || GROUPING.DEFAULT_COLOR,
        },
    });

    const {
        register,
        formState: { errors, isSubmitting },
        setValue,
        watch,
    } = form;

    const selectedColor = watch('color');

    // Filter available parents (exclude current grouping)
    const availableParents = allGroupings.filter(g => g.id !== grouping?.id);

    const handleReassign = async () => {
        if (selectedSubcategories.length === 0 || !targetParentId) return;

        setReassigning(true);
        try {
            for (const childId of selectedSubcategories) {
                await reassignSubcategoryMutation.mutateAsync({
                    childId,
                    newParentId: targetParentId,
                });
            }
            setSelectedSubcategories([]);
            setTargetParentId('');
            setIsSubcategoriesOpen(false);
        } catch (error) {
            console.error('Error reassigning subcategories:', error);
        } finally {
            setReassigning(false);
        }
    };

    const handleClose = () => {
        resetForm();
        setSelectedSubcategories([]);
        setTargetParentId('');
        setIsSubcategoriesOpen(false);
        setIsTargetParentOpen(false);
        onOpenChange(false);
    };

    const toggleSubcategory = (childId: string) => {
        if (selectedSubcategories.includes(childId)) {
            setSelectedSubcategories(selectedSubcategories.filter(id => id !== childId));
        } else {
            setSelectedSubcategories([...selectedSubcategories, childId]);
        }
    };

    const handleSelectAll = () => {
        if (selectedSubcategories.length === children.length) {
            setSelectedSubcategories([]);
        } else {
            setSelectedSubcategories(children.map(c => c.id));
        }
    };

    // Reset state when modal opens
    useEffect(() => {
        if (open && grouping) {
            setSelectedSubcategories([]);
            setTargetParentId('');
            setIsSubcategoriesOpen(false);
            setIsTargetParentOpen(false);
        }
    }, [open, grouping]);

    if (!grouping) return null;

    const selectedParent = availableParents.find(p => p.id === targetParentId);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-sm p-0 gap-0 rounded-3xl shadow-2xl bg-white animate-in fade-in zoom-in-95 overflow-visible">
                {/* Header */}
                <div className="flex items-center gap-2 p-4 border-b border-gray-100">
                    <div className="bg-gray-50 p-2 rounded-full">
                        <Pencil className="h-[18px] w-[18px] text-gray-400" />
                    </div>
                    <DialogTitle className="text-sm font-bold text-gray-900">Edit Category</DialogTitle>
                </div>

                {/* Body */}
                <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-6">
                    {/* Name Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">
                            Category Name
                        </label>
                        <Input
                            type="text"
                            placeholder="e.g. Food & Dining"
                            {...register('name')}
                            disabled={isSubmitting}
                            className="text-lg text-gray-800 bg-gray-50 border-transparent focus:border-gray-200 focus:bg-white rounded-xl px-4 py-3 transition-all"
                        />
                        {errors.name && (
                            <p className="text-sm text-red-600">{errors.name.message as string}</p>
                        )}
                    </div>

                    {/* Color Picker */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">
                            Color Theme
                        </label>
                        <div className="grid grid-cols-5 gap-3">
                            {COLOR_PALETTE.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setValue('color', color, { shouldDirty: true })}
                                    className={cn(
                                        "w-10 h-10 rounded-full transition-transform hover:scale-110",
                                        selectedColor === color && "scale-110 ring-2 ring-offset-2 ring-gray-300"
                                    )}
                                    style={{ backgroundColor: color }}
                                >
                                    {selectedColor === color && (
                                        <Check className="h-4 w-4 text-white mx-auto drop-shadow-md" />
                                    )}
                                </button>
                            ))}
                        </div>
                        {errors.color && (
                            <p className="text-sm text-red-600">{errors.color.message as string}</p>
                        )}
                    </div>

                    {/* Subcategory Management Section */}
                    {children.length > 0 && (
                        <>
                            {/* Divider */}
                            <div className="border-t border-gray-100 pt-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <FolderOpen className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm font-semibold text-gray-700">Subcategories</span>
                                </div>

                                {/* Multi-Select Dropdown */}
                                <div className="space-y-2 relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsSubcategoriesOpen(!isSubcategoriesOpen)}
                                        className={cn(
                                            "w-full border rounded-xl p-4 transition-all flex items-center justify-between",
                                            isSubcategoriesOpen
                                                ? "bg-gray-100 border-gray-300"
                                                : "bg-gray-50 border-gray-100"
                                        )}
                                    >
                                        <span className={cn(
                                            "text-sm",
                                            selectedSubcategories.length > 0
                                                ? "text-gray-900 font-medium"
                                                : "text-gray-500"
                                        )}>
                                            {selectedSubcategories.length > 0
                                                ? `${selectedSubcategories.length} selected`
                                                : 'Select subcategories...'}
                                        </span>
                                        <ChevronDown
                                            className={cn(
                                                "h-4 w-4 text-gray-400 transition-transform",
                                                isSubcategoriesOpen && "rotate-180"
                                            )}
                                        />
                                    </button>

                                    {/* Dropdown Menu */}
                                    {isSubcategoriesOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                                            {/* Header */}
                                            <div className="bg-gray-50/50 border-b border-gray-50 px-4 py-2 flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                    Available Subcategories
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleSelectAll}
                                                    className="text-[10px] font-bold text-blue-500 uppercase tracking-wider hover:text-blue-600"
                                                >
                                                    {selectedSubcategories.length === children.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>

                                            {/* List */}
                                            <div className="max-h-[200px] overflow-y-auto">
                                                {children.map((child) => {
                                                    const isSelected = selectedSubcategories.includes(child.id);
                                                    return (
                                                        <button
                                                            key={child.id}
                                                            type="button"
                                                            onClick={() => toggleSubcategory(child.id)}
                                                            className="w-full px-4 py-3 border-b border-gray-50 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                                        >
                                                            {isSelected ? (
                                                                <CheckSquare className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                            ) : (
                                                                <Square className="h-4 w-4 text-gray-300 flex-shrink-0" />
                                                            )}
                                                            <span className="flex-1 text-left text-sm text-gray-800">
                                                                {child.name}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Target Parent Selector - Conditional */}
                                {selectedSubcategories.length > 0 && (
                                    <div className="space-y-2 relative mt-4 animate-in slide-in-from-top">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                            Move selected to:
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsTargetParentOpen(!isTargetParentOpen)}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                {selectedParent && (
                                                    <div
                                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: selectedParent.color }}
                                                    />
                                                )}
                                                <span className={cn(
                                                    "text-sm",
                                                    selectedParent ? "text-gray-900 font-medium" : "text-gray-500"
                                                )}>
                                                    {selectedParent?.name || 'Select parent...'}
                                                </span>
                                            </div>
                                            <ChevronDown
                                                className={cn(
                                                    "h-4 w-4 text-gray-400 transition-transform",
                                                    isTargetParentOpen && "rotate-180"
                                                )}
                                            />
                                        </button>

                                        {/* Target Parent Dropdown */}
                                        {isTargetParentOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                                                <div className="py-1 max-h-[200px] overflow-y-auto">
                                                    {availableParents.map((parent) => (
                                                        <button
                                                            key={parent.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setTargetParentId(parent.id);
                                                                setIsTargetParentOpen(false);
                                                            }}
                                                            className="w-full px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                                        >
                                                            <div
                                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: parent.color }}
                                                            />
                                                            <span className="flex-1 text-left text-sm text-gray-800">
                                                                {parent.name}
                                                            </span>
                                                            {targetParentId === parent.id && (
                                                                <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                            {error}
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="border-t border-gray-100 p-4 rounded-b-3xl">
                    <button
                        type="submit"
                        onClick={(e) => {
                            e.preventDefault();
                            if (selectedSubcategories.length > 0 && targetParentId) {
                                void handleReassign().then(() => {
                                    void handleSubmit(e);
                                });
                            } else {
                                void handleSubmit(e);
                            }
                        }}
                        disabled={isSubmitting || reassigning}
                        className="w-full bg-gray-900 text-white text-sm font-bold rounded-xl py-3 shadow-lg shadow-gray-200 hover:shadow-xl hover:bg-black active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting || reassigning ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
