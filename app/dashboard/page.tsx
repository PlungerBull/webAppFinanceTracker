import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            Welcome back!
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Here's an overview of your finances
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Balance</CardTitle>
              <CardDescription>Across all accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                $0.00
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This Month</CardTitle>
              <CardDescription>Income vs Expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Income</span>
                  <span className="text-sm font-medium text-green-600">$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Expenses</span>
                  <span className="text-sm font-medium text-red-600">$0.00</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>Active accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                0
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Set up your finance tracker in a few easy steps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                    Create your first account
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Add a bank account, credit card, or cash account to start tracking
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                    Add your first transaction
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Record income, expenses, or transfers between accounts
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                    Explore insights
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    View spending patterns and category breakdowns
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
