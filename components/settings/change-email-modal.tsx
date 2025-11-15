'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  changeEmailSchema,
  type ChangeEmailFormData,
} from '@/features/auth/schemas/profile.schema';
import { authApi } from '@/features/auth/api/auth';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface ChangeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeEmailModal({ open, onOpenChange }: ChangeEmailModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ChangeEmailFormData>({
    resolver: zodResolver(changeEmailSchema),
  });

  const onSubmit = async (data: ChangeEmailFormData) => {
    try {
      setError(null);
      setSuccess(false);
      await authApi.changeEmail(data);
      setSuccess(true);
      reset();
      setTimeout(() => onOpenChange(false), 3000); // Close after 3s
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change email');
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
          <DialogTitle>Change Email</DialogTitle>
          <DialogDescription>
            Enter your new email and current password. A confirmation will be
            sent to both your old and new email addresses.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="p-4 text-green-700 bg-green-50 dark:bg-green-900/20 rounded-md">
            Success! Please check your email to confirm the change.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email</Label>
              <Input
                id="newEmail"
                type="email"
                {...register('newEmail')}
                disabled={isSubmitting}
              />
              {errors.newEmail && (
                <p className="text-sm text-red-600">
                  {errors.newEmail.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPassword-email">Current Password</Label>
              <Input
                id="currentPassword-email"
                type="password"
                {...register('currentPassword')}
                disabled={isSubmitting}
              />
              {errors.currentPassword && (
                <p className="text-sm text-red-600">
                  {errors.currentPassword.message}
                </p>
              )}
            </div>
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
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                OK
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}