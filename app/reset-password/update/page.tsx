'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/features/auth/api/auth';
import { updatePasswordSchema, type UpdatePasswordFormData } from '@/features/auth/schemas/auth.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AUTH } from '@/lib/constants';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
  });

  const onSubmit = async (data: UpdatePasswordFormData) => {
    try {
      setError(null);
      await authApi.updatePassword(data.password);
      router.push(`/login?message=${AUTH.UPDATE_PASSWORD.MESSAGES.SUCCESS_REDIRECT}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : AUTH.UPDATE_PASSWORD.MESSAGES.ERROR);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{AUTH.UPDATE_PASSWORD.TITLE}</CardTitle>
          <CardDescription>
            {AUTH.UPDATE_PASSWORD.DESCRIPTION}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">{AUTH.UPDATE_PASSWORD.LABELS.NEW_PASSWORD}</Label>
              <Input
                id="password"
                type="password"
                placeholder={AUTH.UPDATE_PASSWORD.PLACEHOLDERS.PASSWORD}
                {...register('password')}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{AUTH.UPDATE_PASSWORD.LABELS.CONFIRM_PASSWORD}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={AUTH.UPDATE_PASSWORD.PLACEHOLDERS.PASSWORD}
                {...register('confirmPassword')}
                disabled={isSubmitting}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {AUTH.UPDATE_PASSWORD.BUTTONS.UPDATING}
                </>
              ) : (
                AUTH.UPDATE_PASSWORD.BUTTONS.UPDATE
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
