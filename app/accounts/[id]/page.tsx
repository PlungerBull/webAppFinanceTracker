import { redirect } from 'next/navigation';
import { isServerAuthenticated } from '@/lib/auth';

interface AccountPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { id } = await params;

  if (!(await isServerAuthenticated())) {
    redirect('/login');
  }

  // Redirect to transactions page with account filter
  redirect(`/transactions?account=${id}`);
}
