'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAddGrouping } from '@/features/groupings/hooks/use-groupings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, Loader2, Pencil, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT, VALIDATION, ACCOUNTS } from '@/lib/constants';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface AddCategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Schema for the form
const categorySchema = z.object({
    name: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CATEGORY_NAME_REQUIRED),
    color: z.string().regex(ACCOUNT.COLOR_REGEX, ACCOUNTS.MESSAGES.ERROR.VALIDATION_COLOR_INVALID),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export function AddCategoryModal({ open, onOpenChange }: AddCategoryModalProps) {
    const addGroupingMutation = useAddGrouping();
    const [categoryType, setCategoryType] = useState<'income' | 'expense'>('expense');
    const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: '',
            color: ACCOUNT.DEFAULT_COLOR,
        }
    });

    const selectedColor = watch('color');
    const groupingName = watch('name');

    // Get first letter for icon
    const getInitial = () => {
        return groupingName ? groupingName.charAt(0).toUpperCase() : 'G';
    };

    const handleClose = () => {
        reset();
        setCategoryType('expense'); // Reset to default
        setIsColorPopoverOpen(false);
        onOpenChange(false);
    };

    const onSubmit = async (data: CategoryFormData) => {
        try {
            await addGroupingMutation.mutateAsync({
                name: data.name,
                color: data.color,
                type: categoryType,
            });
            handleClose();
        } catch (error) {
            console.error('Failed to create grouping:', error);
        }
    };


    return (
        <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
            <DialogPrimitive.Portal>
                {/* Backdrop */}
                <DialogPrimitive.Overlay className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">

                    {/* Modal Container */}
                    <DialogPrimitive.Content className="relative w-full max-w-md max-h-[85vh] bg-white rounded-3xl shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
                        <VisuallyHidden>
                            <DialogPrimitive.Title>New Grouping</DialogPrimitive.Title>
                            <DialogPrimitive.Description>
                                Create a new category grouping with name, color, and type
                            </DialogPrimitive.Description>
                        </VisuallyHidden>

                        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                            {/* Hero Header (Icon + Title + Type Toggle + Close) - Fixed */}
                            <div className="px-6 pt-6 pb-5 flex items-start gap-4 shrink-0">
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
                                    />
                                    <Pencil className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                    {errors.name && <p className="text-xs text-red-500 mt-1 px-4">{errors.name.message}</p>}
                                </div>

                                {/* Type Toggle (Top Right) */}
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
                                <p className="text-sm text-gray-500">
                                    This grouping will contain subcategories for organizing your transactions.
                                </p>
                            </div>

                            {/* Footer - Fixed */}
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
                    </DialogPrimitive.Content>
                </DialogPrimitive.Overlay>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
