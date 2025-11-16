import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface AccountPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Redirect to transactions page with account filter
  redirect(`/transactions?account=${id}`);
}
