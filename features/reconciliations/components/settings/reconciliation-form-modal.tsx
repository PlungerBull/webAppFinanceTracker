'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useAccountsData } from '@/lib/hooks/use-reference-data';
import {
  useCreateReconciliation,
  useUpdateReconciliation,
  useReconciliation,
} from '@/lib/hooks/use-reconciliations';
import { cn } from '@/lib/utils';
import { toCents, fromCents } from '@/lib/utils/cents-conversion';
import {
  reconciliationSchema,
  type ReconciliationFormData,
} from '../../schemas/reconciliation.schema';

interface ReconciliationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reconciliationId?: string | null;
}

/**
 * Reconciliation Form Modal
 *
 * Uses useAccountsData from lib/ to avoid feature-to-feature coupling.
 */
export function ReconciliationFormModal({
  open,
  onOpenChange,
  reconciliationId,
}: ReconciliationFormModalProps) {
  const isEditing = !!reconciliationId;
  const { accounts } = useAccountsData();
  const { data: existingReconciliation } = useReconciliation(reconciliationId || '');
  const createMutation = useCreateReconciliation();
  const updateMutation = useUpdateReconciliation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<ReconciliationFormData>({
    resolver: zodResolver(reconciliationSchema),
  });

  const dateStart = useWatch({
    control,
    name: 'dateStart',
    defaultValue: null,
  });
  const dateEnd = useWatch({
    control,
    name: 'dateEnd',
    defaultValue: null,
  });
  const accountId = useWatch({
    control,
    name: 'accountId',
    defaultValue: '',
  });

  // Populate form when editing
  // HARDENED: Convert cents to decimal for display
  useEffect(() => {
    if (isEditing && existingReconciliation) {
      setValue('accountId', existingReconciliation.accountId);
      setValue('name', existingReconciliation.name);
      // Convert cents to decimal for form display
      setValue('beginningBalance', fromCents(existingReconciliation.beginningBalance));
      setValue('endingBalance', fromCents(existingReconciliation.endingBalance));
      setValue('dateStart', existingReconciliation.dateStart);
      setValue('dateEnd', existingReconciliation.dateEnd);
    } else if (!isEditing) {
      reset();
    }
  }, [isEditing, existingReconciliation, setValue, reset]);

  const onSubmit = async (data: ReconciliationFormData) => {
    try {
      // HARDENED: Convert decimal input to cents at the boundary
      const dataWithCents = {
        ...data,
        beginningBalance: toCents(data.beginningBalance),
        endingBalance: toCents(data.endingBalance),
      };

      if (isEditing) {
        await updateMutation.mutateAsync({
          id: reconciliationId,
          updates: dataWithCents,
        });
      } else {
        await createMutation.mutateAsync(dataWithCents);
      }
      onOpenChange(false);
      reset();
    } catch {
      // Error handled by mutation hooks
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Reconciliation' : 'New Reconciliation'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Account Selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Account
            </label>
            <Select
              value={accountId}
              onValueChange={(value) => setValue('accountId', value)}
              disabled={isEditing} // Cannot change account for existing reconciliation
            >
              <SelectTrigger
                className={cn(
                  'w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-colors',
                  errors.accountId && 'border-red-500'
                )}
              >
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((account): account is typeof account & { id: string; name: string; currencyCode: string } =>
                    Boolean(account.id && account.name && account.currencyCode)
                  )
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currencyCode})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.accountId && (
              <p className="text-xs text-red-500">{errors.accountId.message}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Reconciliation Name
            </label>
            <Input
              {...register('name')}
              placeholder="e.g., Dec 2025 Bank Statement"
              className={cn(
                'bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-colors',
                errors.name && 'border-red-500'
              )}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {/* Balance Fields (Side by Side) */}
          {/* HARDENED: Removed step="0.01" - use toCents() for conversion */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Beginning Balance
              </label>
              <Input
                type="number"
                step="any"
                {...register('beginningBalance', { valueAsNumber: true })}
                placeholder="0.00"
                className="bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-colors font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Ending Balance
              </label>
              <Input
                type="number"
                step="any"
                {...register('endingBalance', { valueAsNumber: true })}
                placeholder="0.00"
                className="bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-colors font-mono"
              />
            </div>
          </div>

          {/* Date Range (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Start Date (Optional)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal bg-gray-50 border-2 border-transparent hover:bg-gray-100 focus:border-blue-500 focus:bg-white transition-colors',
                      !dateStart && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateStart ? format(new Date(dateStart), 'MMM dd, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateStart ? new Date(dateStart) : undefined}
                    onSelect={(date) => setValue('dateStart', date?.toISOString() || null)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                End Date (Optional)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal bg-gray-50 border-2 border-transparent hover:bg-gray-100 focus:border-blue-500 focus:bg-white transition-colors',
                      !dateEnd && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateEnd ? format(new Date(dateEnd), 'MMM dd, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateEnd ? new Date(dateEnd) : undefined}
                    onSelect={(date) => setValue('dateEnd', date?.toISOString() || null)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
