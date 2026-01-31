'use client';

import { useState, ReactNode } from 'react';
import { useForm, FieldValues, UseFormReturn, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodSchema } from 'zod';

/**
 * Create typed zodResolver for react-hook-form.
 * Workaround for Zod v4 / @hookform/resolvers type incompatibility.
 * See: https://github.com/react-hook-form/resolvers/issues/451
 */
function createTypedResolver<T extends FieldValues>(
  schema: ZodSchema<T>
): Resolver<T> {
  return zodResolver(schema as Parameters<typeof zodResolver>[0]) as Resolver<T>;
}
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

/**
 * FormModal Props
 *
 * CTO Standard: Fully typed generic interface - no `any` types.
 * The schema generic ensures type safety flows through the entire form.
 *
 * @template TFormData - The shape of the form data, inferred from the Zod schema
 */
interface FormModalProps<TFormData extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  successMessage: string;
  /** Zod schema for form validation - type inference flows to onSubmit and children */
  schema: ZodSchema<TFormData>;
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
    // CTO Note: Typed resolver wrapper handles Zod v4 + react-hook-form type mismatch
    resolver: createTypedResolver(schema),
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
