'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { accountsApi } from '@/features/accounts/api/accounts';
import { createAccountSchema, type CreateAccountFormData } from '@/features/accounts/schemas/account.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'PEN', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'MXN',
  'BRL', 'INR', 'RUB', 'ZAR', 'KRW', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK'
];

export default function NewAccountPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAccountFormData>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      starting_balance: 0,
      currency: 'USD',
    },
  });

  const onSubmit = async (data: CreateAccountFormData) => {
    try {
      setError(null);
      await accountsApi.create(data);
      setSuccess(true);

      // Redirect to dashboard after 1 second
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    }
  };

  if (success) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl text-green-600">Account Created!</CardTitle>
              <CardDescription>
                Your account has been created successfully. Redirecting...
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Add New Account</CardTitle>
            <CardDescription>
              Create a new account to track your finances. This could be a bank account, credit card, cash, or any other financial account.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Account Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g., Checking Account, Savings, Cash, Credit Card"
                  {...register('name')}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Give your account a descriptive name so you can easily identify it
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="starting_balance">Starting Balance</Label>
                <Input
                  id="starting_balance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('starting_balance', { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
                {errors.starting_balance && (
                  <p className="text-sm text-red-600">{errors.starting_balance.message}</p>
                )}
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Enter the current balance of this account (optional, defaults to 0)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <div className="space-y-2">
                  <Input
                    id="currency"
                    type="text"
                    placeholder="Enter 3-letter currency code (e.g., USD, EUR, PEN)"
                    maxLength={3}
                    {...register('currency')}
                    disabled={isSubmitting}
                    className="uppercase"
                  />
                  {errors.currency && (
                    <p className="text-sm text-red-600">{errors.currency.message}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 w-full">
                      Common currencies:
                    </p>
                    {COMMON_CURRENCIES.slice(0, 10).map((curr) => (
                      <Button
                        key={curr}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.getElementById('currency') as HTMLInputElement;
                          if (input) {
                            input.value = curr;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                          }
                        }}
                        disabled={isSubmitting}
                      >
                        {curr}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
