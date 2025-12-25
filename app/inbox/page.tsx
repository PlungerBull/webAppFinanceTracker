import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { InboxTable } from '@/features/inbox/components/inbox-table';

export default async function InboxPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <InboxTable />;
}
