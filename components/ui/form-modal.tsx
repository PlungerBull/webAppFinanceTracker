'use client';

import { useState, ReactNode } from 'react';
import { useForm, FieldValues, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodType } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { UI } from '@/lib/constants';

interface FormModalProps<TFormData extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  successMessage: string;
  schema: ZodType<TFormData, any, any>;
  onSubmit: (data: TFormData) => Promise<void>;
  children: (form: UseFormReturn<TFormData>) => ReactNode;
  autoCloseDelay?: number;
}

export function FormModal<TFormData extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  successMessage,
  schema,
  onSubmit: onSubmitProp,
  children,
  autoCloseDelay = UI.AUTO_CLOSE_DELAY.DEFAULT,
}: FormModalProps<TFormData>) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<TFormData>({
    resolver: zodResolver(schema),
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = form;

  const onSubmit = async (data: TFormData) => {
    try {
      setError(null);
      setSuccess(false);
      await onSubmitProp(data);
      setSuccess(true);
      reset();
      setTimeout(() => onOpenChange(false), autoCloseDelay);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    setSuccess(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {success ? (
          <div className="p-4 text-green-700 bg-green-50 dark:bg-green-900/20 rounded-md">
            {successMessage}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}

            {children(form)}

            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                OK
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
