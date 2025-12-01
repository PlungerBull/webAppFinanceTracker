'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUpdateCategory, useCategories } from '../hooks/use-categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Pencil,
    X,
    Check,
    FolderOpen,
    ChevronDown,
    Square,
    CheckSquare,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT, VALIDATION, ACCOUNTS } from '@/lib/constants';
import type { Database } from '@/types/database.types';
import * as DialogPrimitive from '@radix-ui/react-dialog';

// Use the view type which includes transaction_count
type Category = Database['public']['Views']['categories_with_counts']['Row'];

interface EditGroupingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: Category | null;
}

// Schema for the form
const categorySchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CATEGORY_NAME_REQUIRED),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export function EditGroupingModal({ open, onOpenChange, category }: EditGroupingModalProps) {
    const updateCategoryMutation = useUpdateCategory();
    const { data: allCategories = [] } = useCategories();

    // State for subcategory management
    const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);
    const [migrationTargetId, setMigrationTargetId] = useState<string | null>(null);
    const [isSubcategoryDropdownOpen, setIsSubcategoryDropdownOpen] = useState(false);
    const [isMigrationDropdownOpen, setIsMigrationDropdownOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);

    // Refs for click-outside detection
    const subcategoryDropdownRef = useRef<HTMLDivElement>(null);
    const migrationDropdownRef = useRef<HTMLDivElement>(null);

    // Filter subcategories for the current category
    const subcategories = useMemo(() =>
        allCategories.filter(c => c.parent_id === category?.id && c.id !== null) as (Category & { id: string })[],
        [allCategories, category?.id]
    );

    // Filter available parents for migration (exclude current category and its children)
    const availableParents = useMemo(() =>
        allCategories.filter(c =>
            c.parent_id === null && // Must be a parent
            c.id !== category?.id && // Cannot be the current category
            c.id !== null // Must have an ID
        ) as (Category & { id: string })[],
        [allCategories, category?.id]
    );

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema),
        values: category ? {
            name: category.name || '',
            color: category.color || ACCOUNT.DEFAULT_COLOR,
        } : undefined,
        defaultValues: {
            name: '',
            color: ACCOUNT.DEFAULT_COLOR,
        }
    });

    const selectedColor = watch('color');

    useEffect(() => {
        if (open && category) {
            setSelectedSubcategoryIds([]);
            setMigrationTargetId(null);
        }
    }, [open, category]);

    // Click-outside detection for dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Close subcategory dropdown if click is outside
            if (
                subcategoryDropdownRef.current &&
                !subcategoryDropdownRef.current.contains(event.target as Node) &&
                isSubcategoryDropdownOpen
            ) {
                setIsSubcategoryDropdownOpen(false);
            }

            // Close migration dropdown if click is outside
            if (
                migrationDropdownRef.current &&
                !migrationDropdownRef.current.contains(event.target as Node) &&
                isMigrationDropdownOpen
            ) {
                setIsMigrationDropdownOpen(false);
            }
        };

        // Add event listener to document
        document.addEventListener('mousedown', handleClickOutside);

        // Cleanup on unmount
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSubcategoryDropdownOpen, isMigrationDropdownOpen]);

    const handleClose = () => {
        onOpenChange(false);
    };

    const onSubmit = async (data: CategoryFormData) => {
        if (!category?.id) return;

        try {
            // 1. Update the main category
            const updatePromises: Promise<any>[] = [
                updateCategoryMutation.mutateAsync({
                    id: category.id,
                    data: {
                        name: data.name,
                        color: data.color,
                    },
                })
            ];

            // 2. Handle bulk migration if selected
            if (selectedSubcategoryIds.length > 0 && migrationTargetId) {
                selectedSubcategoryIds.forEach(subId => {
                    updatePromises.push(
                        updateCategoryMutation.mutateAsync({
                            id: subId,
                            data: { parent_id: migrationTargetId }
                        })
                    );
                });
            }

            await Promise.all(updatePromises);
            handleClose();
        } catch (error) {
            console.error('Failed to update category:', error);
        }
    };

    const toggleSubcategorySelection = (id: string) => {
        setSelectedSubcategoryIds(prev =>
            prev.includes(id)
                ? prev.filter(subId => subId !== id)
                : [...prev, id]
        );
    };

    const toggleAllSubcategories = () => {
        if (selectedSubcategoryIds.length === subcategories.length) {
            setSelectedSubcategoryIds([]);
        } else {
            setSelectedSubcategoryIds(subcategories.map(s => s.id));
        }
    };

    const getMigrationTargetName = () => {
        if (!migrationTargetId) return null;
        return availableParents.find(p => p.id === migrationTargetId)?.name;
    };

    // Color Palette
    const colorPalette = [
        '#F97316', // Orange (Active default in design)
        '#3B82F6', // Blue
        '#10B981', // Emerald
        '#EAB308', // Yellow
        '#8B5CF6', // Violet
        '#EC4899', // Pink
        '#EF4444', // Red
        '#6B7280', // Gray
        '#14B8A6', // Teal
        '#F43F5E', // Rose
    ];

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                {/* Backdrop */}
                <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 animate-in fade-in duration-200" />

                {/* Modal Container */}
                <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] outline-none animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-visible flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-50 p-2 rounded-full">
                                    <Pencil className="w-[18px] h-[18px] text-gray-400" />
                                </div>
                                <DialogPrimitive.Title asChild>
                                    <h2 className="text-sm font-bold text-gray-900">Edit Grouping</h2>
                                </DialogPrimitive.Title>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body (Scrollable) */}
                        <div className="p-6 space-y-6 overflow-y-auto">
                            {/* Name Input */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-500 uppercase">GROUPING NAME</Label>
                                {isEditingName ? (
                                    <Input
                                        {...register('name')}
                                        autoFocus
                                        autoComplete="off"
                                        onBlur={() => setIsEditingName(false)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                setIsEditingName(false);
                                            }
                                        }}
                                        className="text-lg text-gray-800 bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-xl px-4 py-6 shadow-none transition-all"
                                        placeholder="Category Name"
                                    />
                                ) : (
                                    <div
                                        onClick={() => setIsEditingName(true)}
                                        className="group flex items-center gap-2 cursor-pointer py-3 px-2 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        <span className="text-2xl font-bold text-gray-900">
                                            {watch('name') || 'Unnamed Grouping'}
                                        </span>
                                        <Pencil className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                )}
                                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                            </div>

                            {/* Color Picker */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-500 uppercase">COLOR THEME</Label>
                                <div className="grid grid-cols-5 gap-3">
                                    {colorPalette.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setValue('color', color, { shouldDirty: true })}
                                            className={cn(
                                                "w-10 h-10 rounded-full transition-all flex items-center justify-center hover:scale-110",
                                                selectedColor === color
                                                    ? "scale-110 ring-2 ring-offset-2 ring-gray-300 shadow-md"
                                                    : ""
                                            )}
                                            style={{ backgroundColor: color }}
                                        >
                                            {selectedColor === color && (
                                                <Check className="w-5 h-5 text-white drop-shadow-md" strokeWidth={3} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Subcategory Management */}
                            {subcategories.length > 0 && (
                                <>
                                    <div className="border-t border-gray-100 pt-4 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <FolderOpen className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-semibold text-gray-700">Subcategories</span>
                                        </div>

                                        {/* Multi-Select Dropdown */}
                                        <div className="relative" ref={subcategoryDropdownRef}>
                                            <button
                                                type="button"
                                                onClick={() => setIsSubcategoryDropdownOpen(!isSubcategoryDropdownOpen)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors border",
                                                    isSubcategoryDropdownOpen
                                                        ? "bg-gray-100 border-gray-300"
                                                        : "bg-gray-50 border-gray-100 text-gray-500"
                                                )}
                                            >
                                                <span className={cn(selectedSubcategoryIds.length > 0 ? "text-gray-900 font-medium" : "")}>
                                                    {selectedSubcategoryIds.length > 0
                                                        ? `${selectedSubcategoryIds.length} selected`
                                                        : "Select subcategories..."}
                                                </span>
                                                <ChevronDown className={cn("w-4 h-4 transition-transform", isSubcategoryDropdownOpen ? "rotate-180" : "")} />
                                            </button>

                                            {/* Floating Menu */}
                                            {isSubcategoryDropdownOpen && (
                                                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                                                    <div className="bg-gray-50/50 border-b border-gray-50 px-4 py-2 flex justify-between items-center">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">AVAILABLE SUBCATEGORIES</span>
                                                        <button
                                                            type="button"
                                                            onClick={toggleAllSubcategories}
                                                            className="text-[10px] font-bold text-blue-500 hover:text-blue-600 uppercase"
                                                        >
                                                            {selectedSubcategoryIds.length === subcategories.length ? "DESELECT ALL" : "SELECT ALL"}
                                                        </button>
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto">
                                                        {subcategories.map(sub => (
                                                            <div
                                                                key={sub.id}
                                                                onClick={() => toggleSubcategorySelection(sub.id)}
                                                                className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3 hover:bg-gray-50 cursor-pointer"
                                                            >
                                                                {selectedSubcategoryIds.includes(sub.id) ? (
                                                                    <CheckSquare className="w-5 h-5 text-blue-500 fill-blue-50" />
                                                                ) : (
                                                                    <Square className="w-5 h-5 text-gray-300" />
                                                                )}
                                                                <span className="text-sm text-gray-700">{sub.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Migration Target Selector (Conditional) */}
                                    {selectedSubcategoryIds.length > 0 && (
                                        <div className="space-y-2 animate-in slide-in-from-top-2 fade-in">
                                            <Label className="text-[10px] font-bold text-gray-400 uppercase">MOVE SELECTED TO:</Label>
                                            <div className="relative" ref={migrationDropdownRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsMigrationDropdownOpen(!isMigrationDropdownOpen)}
                                                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm hover:border-gray-300 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {migrationTargetId && (
                                                            <div
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: availableParents.find(p => p.id === migrationTargetId)?.color || '#9CA3AF' }}
                                                            />
                                                        )}
                                                        <span className={migrationTargetId ? "text-gray-900" : "text-gray-500"}>
                                                            {getMigrationTargetName() || "Select new parent..."}
                                                        </span>
                                                    </div>
                                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                                </button>

                                                {isMigrationDropdownOpen && (
                                                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 z-40 overflow-hidden max-h-48 overflow-y-auto">
                                                        {availableParents.map(parent => (
                                                            <div
                                                                key={parent.id}
                                                                onClick={() => {
                                                                    setMigrationTargetId(parent.id);
                                                                    setIsMigrationDropdownOpen(false);
                                                                }}
                                                                className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                                                            >
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: parent.color || '#9CA3AF' }} />
                                                                <span className="text-sm text-gray-700">{parent.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 shrink-0">
                            <Button
                                onClick={handleSubmit(onSubmit)}
                                disabled={isSubmitting}
                                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-6 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl transition-all"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
