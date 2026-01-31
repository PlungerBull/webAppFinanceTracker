import { useCallback, useState } from 'react';
import { useForm, UseFormProps, UseFormReturn, FieldValues, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * Generic hook for form modals with standardized error handling and state management
 * Eliminates duplication across add/edit modals
 *
 * @template T - Form data type that extends FieldValues
 * @param schema - Zod validation schema
 * @param onSubmit - Async submit handler
 * @param options - Optional form configuration
 * @returns Form methods, error state, and handlers
 *
 * @example
 * ```tsx
 * const { form, error, handleClose, handleSubmit } = useFormModal(
 *   accountSchema,
 *   async (data) => await createAccount(data),
 *   { defaultValues: { color: '#3b82f6' } }
 * );
 * ```
 */
export function useFormModal<T extends FieldValues>(
  schema: z.ZodSchema<T>,
  onSubmit: (data: T) => Promise<void>,
  options?: Omit<UseFormProps<T>, 'resolver'>
) {
  const [error, setError] = useState<string | null>(null);

  // Zod v4 / @hookform/resolvers type incompatibility workaround
  // Runtime behavior is correct - this is purely a type-level issue
  // See: https://github.com/react-hook-form/resolvers/issues/451
  const resolver = zodResolver(
    schema as Parameters<typeof zodResolver>[0]
  ) as Resolver<T>;

  const form = useForm<T>({
    ...options,
    resolver,
  });

  const handleClose = useCallback(() => {
    form.reset();
    setError(null);
  }, [form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      setError(null);
      await onSubmit(data);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  });

  return {
    form,
    error,
    setError,
    handleClose,
    handleSubmit,
  };
}

/**
 * Return type for useFormModal hook
 */
export type UseFormModalReturn<T extends FieldValues> = {
  form: UseFormReturn<T>;
  error: string | null;
  setError: (error: string | null) => void;
  handleClose: () => void;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
};
