'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { authApi } from '@/features/auth/api/auth';
import { loginSchema, type LoginFormData } from '@/features/auth/schemas/auth.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AUTH } from '@/lib/constants';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  // CTO Standard: Read URL params directly in render - no useEffect state sync needed
  // This eliminates the cascading render and ensures instant UI updates on URL changes
  const message = searchParams.get('message');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      await authApi.login(data);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : AUTH.LOGIN.MESSAGES.ERROR);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{AUTH.LOGIN.TITLE}</CardTitle>
          <CardDescription>
            {AUTH.LOGIN.DESCRIPTION}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {message && (
              <div className="p-3 text-sm text-blue-600 bg-white border border-blue-200 dark:bg-blue-900/20 rounded-md">
                {message}
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-600 bg-white border border-red-200 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{AUTH.LOGIN.LABELS.EMAIL}</Label>
              <Input
                id="email"
                type="email"
                placeholder={AUTH.LOGIN.PLACEHOLDERS.EMAIL}
                {...register('email')}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{AUTH.LOGIN.LABELS.PASSWORD}</Label>
                <Link
                  href="/reset-password"
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
                >
                  {AUTH.LOGIN.LABELS.FORGOT_PASSWORD}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={AUTH.LOGIN.PLACEHOLDERS.PASSWORD}
                {...register('password')}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {AUTH.LOGIN.BUTTONS.LOGGING_IN}
                </>
              ) : (
                AUTH.LOGIN.BUTTONS.LOGIN
              )}
            </Button>

            <p className="text-sm text-center text-zinc-600 dark:text-zinc-400">
              {AUTH.LOGIN.LABELS.NO_ACCOUNT}{' '}
              <Link href="/signup" className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline">
                {AUTH.LOGIN.LABELS.SIGN_UP}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">{AUTH.LOGIN.TITLE}</CardTitle>
            <CardDescription>{AUTH.LOGIN.MESSAGES.LOADING}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
