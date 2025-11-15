'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  updateProfileSchema,
  type UpdateProfileFormData,
} from '@/features/auth/schemas/profile.schema';
import { authApi } from '@/features/auth/api/auth';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { ChangePasswordModal } from '@/components/settings/change-password-modal';
import { ChangeEmailModal } from '@/components/settings/change-email-modal';
import { getInitials } from '@/lib/utils'; // <-- IMPORT IT HERE

export default function SettingsPage() {
  const { user, initialize } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: user?.user_metadata?.firstName || '',
      lastName: user?.user_metadata?.lastName || '',
    },
  });

  // Update form defaults when user object changes
  useEffect(() => {
    if (user) {
      reset({
        firstName: user.user_metadata?.firstName || '',
        lastName: user.user_metadata?.lastName || '',
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: UpdateProfileFormData) => {
    try {
      setError(null);
      setSuccess(false);
      await authApi.updateUserMetadata(data);
      setSuccess(true);
      initialize(); // Re-fetch user data to update store
      reset(data); // Reset form to new default values
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update profile'
      );
    }
  };

  const initials = getInitials(
    user?.user_metadata?.firstName,
    user?.user_metadata?.lastName
  );

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 rounded-md">
            Profile updated successfully!
          </div>
        )}

        {/* Profile Avatar and Name */}
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-medium">
            {initials || '?'}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-sm text-red-600">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-sm text-red-600">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Email and Password Section */}
        <div className="space-y-4 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center justify-between">
            <Label>Email</Label>
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {user?.email}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <Label>Password</Label>
            <Button
              type="button"
              variant="link"
              onClick={() => setIsPasswordModalOpen(true)}
              className="text-sm p-0 h-auto"
            >
              Change Password
            </Button>
          </div>
        </div>

        {/* Form Footer */}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Update
          </Button>
        </div>
      </form>

      {/* Nested Modals */}
      <ChangePasswordModal
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
      />
      <ChangeEmailModal
        open={isEmailModalOpen}
        onOpenChange={setIsEmailModalOpen}
      />
    </>
  );
}