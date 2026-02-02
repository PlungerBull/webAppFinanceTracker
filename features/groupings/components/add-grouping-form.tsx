'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAddGrouping } from '../hooks/use-groupings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pencil, Check, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT } from '@/lib/constants';
import { groupingSchema, type GroupingFormData } from '../schemas/grouping.schema';
import type { CategoryType } from '@/domain/categories';

/**
 * Standard form props interface for headless forms.
 * Follows "Smart Logic, Dumb Shells" pattern.
 */
interface AddGroupingFormProps {
    /** Called when the form submits successfully */
    onSuccess: () => void;
    /** Called when an error occurs (optional) */
    onError?: (error: Error) => void;
}

/**
 * AddGroupingForm - Headless form for creating a new grouping (parent category).
 *
 * This is a "smart logic" component that handles:
 * - Form state and validation
 * - Submission via useAddGrouping hook
 * - UI layout (hero header, color picker, type toggle)
 *
 * It does NOT handle:
 * - Modal open/close state
 * - Backdrop, animations, positioning
 *
 * Usage:
 * ```tsx
 * <EntityModal open={isOpen} onOpenChange={setIsOpen} title="New Grouping">
 *   <AddGroupingForm onSuccess={() => setIsOpen(false)} />
 * </EntityModal>
 * ```
 */
export function AddGroupingForm({ onSuccess, onError }: AddGroupingFormProps) {
    const addGroupingMutation = useAddGrouping();
    const [categoryType, setCategoryType] = useState<CategoryType>('expense');
    const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        control,
        formState: { errors, isSubmitting }
    } = useForm<GroupingFormData>({
        resolver: zodResolver(groupingSchema),
        defaultValues: {
            name: '',
            color: ACCOUNT.DEFAULT_COLOR,
        }
    });

    const selectedColor = useWatch({
        control,
        name: 'color',
        defaultValue: ACCOUNT.DEFAULT_COLOR,
    });

    const groupingName = useWatch({
        control,
        name: 'name',
        defaultValue: '',
    });

    // Get first letter for icon
    const getInitial = () => {
        return groupingName ? groupingName.charAt(0).toUpperCase() : 'G';
    };

    const onSubmit = async (data: GroupingFormData) => {
        try {
            await addGroupingMutation.mutateAsync({
                name: data.name,
                color: data.color,
                type: categoryType,
            });
            onSuccess();
        } catch (error) {
            console.error('Failed to create grouping:', error);
            onError?.(error instanceof Error ? error : new Error(String(error)));
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            {/* Hero Header (Icon + Title + Type Toggle) */}
            <div className="px-6 pt-6 pb-5 pr-14 flex items-start gap-4 shrink-0">
                {/* Icon Anchor (Color Trigger) */}
                <Popover open={isColorPopoverOpen} onOpenChange={setIsColorPopoverOpen}>
                    <PopoverTrigger asChild>
                        <div className="relative shrink-0">
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
                        autoComplete="off"
                        autoFocus
                    />
                    <Pencil className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    {errors.name && <p className="text-xs text-red-500 mt-1 px-4">{errors.name.message}</p>}
                </div>

                {/* Type Toggle */}
                <div className="bg-gray-100 p-1 rounded-lg flex gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => setCategoryType('expense')}
                        className={cn(
                            'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                            categoryType === 'expense'
                                ? 'bg-white text-red-600 shadow-sm'
                                : 'text-gray-500'
                        )}
                    >
                        Expense
                    </button>
                    <button
                        type="button"
                        onClick={() => setCategoryType('income')}
                        className={cn(
                            'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                            categoryType === 'income'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-gray-500'
                        )}
                    >
                        Income
                    </button>
                </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mx-6 shrink-0" />

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1">
                <p className="text-sm text-gray-500">
                    This grouping will contain subcategories for organizing your transactions.
                </p>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-5 shrink-0">
                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gray-900 hover:bg-black text-white font-bold py-6 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl transition-all active:scale-[0.99]"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                        </>
                    ) : (
                        'Create Group'
                    )}
                </Button>
            </div>
        </form>
    );
}
