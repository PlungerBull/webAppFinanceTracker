'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUpdateGrouping, useGroupings, useReassignSubcategory } from '../hooks/use-groupings';
import { useCategoryOperations } from '@/lib/hooks/use-category-operations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Pencil,
    FolderOpen,
    ChevronDown,
    Square,
    CheckSquare,
    Loader2,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT, VALIDATION, ACCOUNTS } from '@/lib/constants';
import type { GroupingEntity, CategoryType } from '@/domain/categories';
import { useQuery } from '@tanstack/react-query';

/**
 * Standard form props interface for headless forms.
 * Follows "Smart Logic, Dumb Shells" pattern.
 */
interface EditGroupingFormProps {
    /** Called when the form submits successfully */
    onSuccess: () => void;
    /** Called when an error occurs (optional) */
    onError?: (error: Error) => void;
    /** The grouping being edited */
    initialData: GroupingEntity;
}

// Schema for the form
const groupingSchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CATEGORY_NAME_REQUIRED),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
    type: z.enum(['expense', 'income']).optional(),
});

type GroupingFormData = z.infer<typeof groupingSchema>;

/**
 * EditGroupingForm - Headless form for editing a grouping (parent category).
 *
 * This is a "smart logic" component that handles:
 * - Form state and validation
 * - Submission via useUpdateGrouping hook
 * - Subcategory selection and migration
 * - UI layout (hero header, color picker, type toggle, subcategory list)
 *
 * It does NOT handle:
 * - Modal open/close state
 * - Backdrop, animations, positioning
 *
 * Usage:
 * ```tsx
 * <EntityModal open={isOpen} onOpenChange={setIsOpen} title="Edit Grouping">
 *   <EditGroupingForm
 *     initialData={grouping}
 *     onSuccess={() => setIsOpen(false)}
 *   />
 * </EntityModal>
 * ```
 */
export function EditGroupingForm({ onSuccess, onError, initialData }: EditGroupingFormProps) {
    const updateGroupingMutation = useUpdateGrouping();
    const reassignSubcategoryMutation = useReassignSubcategory();
    const { data: allGroupings = [] } = useGroupings();
    const operations = useCategoryOperations();

    // Fetch children of this grouping
    const { data: subcategories = [] } = useQuery({
        queryKey: ['grouping-children', initialData.id],
        queryFn: () => operations?.getByParentId(initialData.id) ?? Promise.resolve([]),
        enabled: !!operations && !!initialData.id,
    });

    // State for subcategory management
    const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);
    const [migrationTargetId, setMigrationTargetId] = useState<string | null>(null);
    const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);
    const [isMigrationDropdownOpen, setIsMigrationDropdownOpen] = useState(false);

    // Ref for click-outside detection
    const migrationDropdownRef = useRef<HTMLDivElement>(null);

    // Filter available parents for migration (exclude current grouping)
    const availableParents = useMemo(() =>
        allGroupings.filter(g => g.id !== initialData.id),
        [allGroupings, initialData.id]
    );

    const {
        register,
        handleSubmit,
        setValue,
        control,
        formState: { errors, isSubmitting }
    } = useForm<GroupingFormData>({
        resolver: zodResolver(groupingSchema),
        defaultValues: {
            name: initialData.name || '',
            color: initialData.color || ACCOUNT.DEFAULT_COLOR,
            type: (initialData.type as CategoryType) || 'expense',
        }
    });

    const selectedColor = useWatch({
        control,
        name: 'color',
        defaultValue: initialData.color || ACCOUNT.DEFAULT_COLOR,
    });

    const selectedType = useWatch({
        control,
        name: 'type',
        defaultValue: (initialData.type as CategoryType) || 'expense',
    });

    const categoryName = useWatch({
        control,
        name: 'name',
        defaultValue: initialData.name || '',
    });

    // Click-outside detection for migration dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                migrationDropdownRef.current &&
                !migrationDropdownRef.current.contains(event.target as Node) &&
                isMigrationDropdownOpen
            ) {
                setIsMigrationDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMigrationDropdownOpen]);

    const onSubmit = async (data: GroupingFormData) => {
        try {
            // 1. Update the main grouping
            const updatePromises: Promise<unknown>[] = [
                updateGroupingMutation.mutateAsync({
                    id: initialData.id,
                    data: {
                        version: initialData.version,
                        name: data.name,
                        color: data.color,
                        type: data.type,
                    },
                })
            ];

            // 2. Handle bulk migration if selected
            if (selectedSubcategoryIds.length > 0 && migrationTargetId) {
                selectedSubcategoryIds.forEach(subId => {
                    updatePromises.push(
                        reassignSubcategoryMutation.mutateAsync({
                            categoryId: subId,
                            newParentId: migrationTargetId,
                        })
                    );
                });
            }

            await Promise.all(updatePromises);
            onSuccess();
        } catch (error) {
            console.error('Failed to update grouping:', error);
            onError?.(error instanceof Error ? error : new Error(String(error)));
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

    // Get first letter for icon
    const getInitial = () => {
        return categoryName ? categoryName.charAt(0).toUpperCase() : '?';
    };

    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            {/* Hero Header (Merged Layout) */}
            <div className="px-8 pt-10 pb-6 pr-14 shrink-0">
                <div className="flex items-start gap-4">
                    {/* Icon Anchor (Color Trigger) */}
                    <Popover open={isColorPopoverOpen} onOpenChange={setIsColorPopoverOpen}>
                        <PopoverTrigger asChild>
                            <div className="relative">
                                <button
                                    type="button"
                                    className="w-14 h-14 rounded-2xl ring-1 ring-black/5 flex items-center justify-center text-white text-xl font-bold drop-shadow-md hover:scale-105 transition-transform cursor-pointer"
                                    style={{ backgroundColor: selectedColor }}
                                >
                                    {getInitial()}
                                </button>
                                <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-sm">
                                    <ChevronDown className="w-3 h-3 text-gray-400" />
                                </div>
                            </div>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-3 bg-white rounded-2xl shadow-xl border border-gray-100">
                            <div className="grid grid-cols-5 gap-3">
                                {ACCOUNT.COLOR_PALETTE.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => {
                                            setValue('color', color, { shouldDirty: true });
                                            setIsColorPopoverOpen(false);
                                        }}
                                        className={cn(
                                            'w-8 h-8 rounded-full transition-all flex items-center justify-center',
                                            selectedColor === color && 'ring-2 ring-offset-2 ring-gray-900'
                                        )}
                                        style={{ backgroundColor: color }}
                                    >
                                        {selectedColor === color && (
                                            <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Title Input (Hero Text) */}
                    <div className="flex-1 relative group">
                        <Input
                            {...register('name')}
                            className={cn(
                                'text-2xl font-bold text-gray-900 border-transparent bg-transparent hover:bg-gray-50 hover:border-gray-200 focus:bg-white focus:border-blue-200 ring-0 focus:ring-0 px-4 py-2 rounded-xl transition-all',
                                errors.name && 'border-red-300'
                            )}
                            placeholder="Grouping name"
                        />
                        <Pencil className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        {errors.name && <p className="text-xs text-red-500 mt-1 px-4">{errors.name.message}</p>}
                    </div>

                    {/* Type Toggle */}
                    <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                        <button
                            type="button"
                            onClick={() => setValue('type', 'expense', { shouldDirty: true })}
                            className={cn(
                                'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                                selectedType === 'expense'
                                    ? 'bg-white text-red-600 shadow-sm'
                                    : 'text-gray-500'
                            )}
                        >
                            Expense
                        </button>
                        <button
                            type="button"
                            onClick={() => setValue('type', 'income', { shouldDirty: true })}
                            className={cn(
                                'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                                selectedType === 'income'
                                    ? 'bg-white text-emerald-600 shadow-sm'
                                    : 'text-gray-500'
                            )}
                        >
                            Income
                        </button>
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-50 shrink-0" />

            {/* Body Section - Scrollable */}
            <div className="px-8 py-6 space-y-6 overflow-y-auto flex-1">
                {/* Subcategory Management */}
                {subcategories.length > 0 && (
                    <div className="space-y-4">
                        {/* Header Row */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FolderOpen className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-semibold text-gray-700">Subcategories ({subcategories.length})</span>
                            </div>
                            <button
                                type="button"
                                onClick={toggleAllSubcategories}
                                className="text-[10px] font-bold text-blue-500 hover:text-blue-600 uppercase tracking-wide"
                            >
                                SELECT ALL
                            </button>
                        </div>

                        {/* List Container */}
                        <div className="bg-gray-50/30 border border-gray-100 rounded-xl max-h-48 overflow-y-auto">
                            {subcategories.map((sub) => (
                                <div
                                    key={sub.id}
                                    onClick={() => toggleSubcategorySelection(sub.id)}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-white cursor-pointer transition-colors',
                                        selectedSubcategoryIds.includes(sub.id) && 'bg-white border border-blue-200'
                                    )}
                                >
                                    {selectedSubcategoryIds.includes(sub.id) ? (
                                        <CheckSquare className="w-5 h-5 text-blue-500" />
                                    ) : (
                                        <Square className="w-5 h-5 text-gray-300" />
                                    )}
                                    <span className="text-sm text-gray-700">{sub.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Migration Tool (Progressive Disclosure) */}
                {selectedSubcategoryIds.length > 0 && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 fade-in">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                            MOVE {selectedSubcategoryIds.length} ITEMS TO:
                        </Label>
                        <div className="relative" ref={migrationDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsMigrationDropdownOpen(!isMigrationDropdownOpen)}
                                className={cn(
                                    'w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border text-sm transition-colors',
                                    isMigrationDropdownOpen ? 'border-blue-300' : 'border-gray-200 hover:border-gray-300'
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={migrationTargetId ? "text-gray-900 font-medium" : "text-gray-500"}>
                                        {getMigrationTargetName() || "Select new parent group..."}
                                    </span>
                                </div>
                                <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", isMigrationDropdownOpen && "rotate-180")} />
                            </button>

                            {isMigrationDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-40 overflow-hidden max-h-48 overflow-y-auto animate-in fade-in zoom-in-95">
                                    {availableParents.map(parent => (
                                        <div
                                            key={parent.id}
                                            onClick={() => {
                                                setMigrationTargetId(parent.id);
                                                setIsMigrationDropdownOpen(false);
                                            }}
                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-2 transition-colors"
                                        >
                                            <span className="text-sm text-gray-700">{parent.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="bg-white rounded-b-3xl border-t border-gray-100 p-4 shrink-0">
                <Button
                    onClick={handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                    className="w-full bg-gray-900 hover:bg-black text-white font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl transition-all"
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
    );
}
