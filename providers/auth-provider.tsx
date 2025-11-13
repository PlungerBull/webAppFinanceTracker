'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize, setUser } = useAuthStore();

  useEffect(() => {
    // Initialize auth state
    initialize();

    // Listen for auth changes
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialize, setUser]);

  return <>{children}</>;
}
