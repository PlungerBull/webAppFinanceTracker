import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Zap, Globe } from 'lucide-react';

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-black">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
            Manage Your Finances
            <br />
            <span className="text-zinc-600 dark:text-zinc-400">Across Multiple Currencies</span>
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
            A personal finance tracker that helps you manage your money across multiple accounts
            and currencies with a beautiful, intuitive interface.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Login
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Quick & Easy
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Add a transaction in under 7 seconds. No loading screens, instant access to your data.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Globe className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Multi-Currency
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Essential for dual-currency economies. Track accounts in USD, EUR, PEN, and more.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Privacy-First
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              You own your data. Export everything anytime. Your financial information is secure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
