'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import {
  useCreateReconciliation,
  useUpdateReconciliation,
  useReconciliation,
} from '@/features/reconciliations/hooks/use-reconciliations';
import { cn } from '@/lib/utils';

const reconciliationSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  name: z.string().min(1, 'Name is required'),
  beginningBalance: z.number(),
  endingBalance: z.number(),
  dateStart: z.string().nullable().optional(),
  dateEnd: z.string().nullable().optional(),
});

type ReconciliationFormData = z.infer<typeof reconciliationSchema>;

interface ReconciliationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reconciliationId?: string | null;
}

export function ReconciliationFormModal({
  open,
  onOpenChange,
  reconciliationId,
}: ReconciliationFormModalProps) {
  const isEditing = !!reconciliationId;
  const { data: accounts = [] } = useAccounts();
  const { data: existingReconciliation } = useReconciliation(reconciliationId || '');
  const createMutation = useCreateReconciliation();
  const updateMutation = useUpdateReconciliation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<ReconciliationFormData>({
    resolver: zodResolver(reconciliationSchema),
  });

  const dateStart = watch('dateStart');
  const dateEnd = watch('dateEnd');

  // Populate form when editing
  useEffect(() => {
    if (isEditing && existingReconciliation) {
      setValue('accountId', existingReconciliation.accountId);
      setValue('name', existingReconciliation.name);
      setValue('beginningBalance', existingReconciliation.beginningBalance);
      setValue('endingBalance', existingReconciliation.endingBalance);
      setValue('dateStart', existingReconciliation.dateStart);
      setValue('dateEnd', existingReconciliation.dateEnd);
    } else if (!isEditing) {
      reset();
    }
  }, [isEditing, existingReconciliation, setValue, reset]);

  const onSubmit = async (data: ReconciliationFormData) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: reconciliationId,
          updates: data,
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      onOpenChange(false);
      reset();
    } catch (error) {
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Account Selector */}
          <div className="space-y-2">
            <Label>Account</Label>
            <Select
              value={watch('accountId')}
              onValueChange={(value) => setValue('accountId', value)}
              disabled={isEditing} // Cannot change account for existing reconciliation
            >
              <SelectTrigger className={cn(errors.accountId && 'border-red-500')}>
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.accountId} value={account.accountId}>
                    {account.name} ({account.currencyCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.accountId && (
              <p className="text-sm text-red-500">{errors.accountId.message}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              {...register('name')}
              placeholder="e.g., Dec 2025 Bank Statement"
              className={cn(errors.name && 'border-red-500')}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          {/* Beginning Balance */}
          <div className="space-y-2">
            <Label>Beginning Balance</Label>
            <Input
              type="number"
              step="0.01"
              {...register('beginningBalance', { valueAsNumber: true })}
              placeholder="0.00"
            />
          </div>

          {/* Ending Balance */}
          <div className="space-y-2">
            <Label>Ending Balance</Label>
            <Input
              type="number"
              step="0.01"
              {...register('endingBalance', { valueAsNumber: true })}
              placeholder="0.00"
            />
          </div>

          {/* Date Range (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
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
              <Label>End Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
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
