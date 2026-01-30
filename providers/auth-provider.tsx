'use client';

/**
 * Auth Provider Component
 *
 * Composition root for authentication.
 * Initializes the IAuthProvider singleton and injects it into authApi.
 *
 * @module auth-provider
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { initAuthApi, isAuthApiInitialized } from '@/features/auth/api/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, initialize } = useAuthStore();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initializedRef.current) return;
    initializedRef.current = true;

    // SINGLETON PROVIDER: Initialize once at composition root
    const supabase = createClient();
    const authProvider = createSupabaseAuthProvider(supabase);

    // IOC INJECTION: Inject provider into authApi singleton
    if (!isAuthApiInitialized()) {
      initAuthApi(authProvider);
    }

    // Initialize auth store (now that authApi is ready)
    initialize();

    // Subscribe to auth changes with filtered events
    const unsubscribe = authProvider.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      unsubscribe();
    };
  }, [initialize, setUser]);

  return <>{children}</>;
}
