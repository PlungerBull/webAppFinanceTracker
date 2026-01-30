'use client';

/**
 * Auth Provider Component
 *
 * Composition root for authentication.
 * Initializes all auth providers and injects them into authApi.
 *
 * Platform Configuration:
 * - Web: IAuthProvider + ICredentialAuthProvider
 * - iOS: IAuthProvider + IOAuthAuthProvider (future)
 *
 * @module auth-provider
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { createSupabaseCredentialProvider } from '@/lib/auth/supabase-credential-provider';
import { initAuthApi, isAuthApiInitialized } from '@/features/auth/api/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, initialize } = useAuthStore();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initializedRef.current) return;
    initializedRef.current = true;

    // SINGLETON PROVIDERS: Initialize once at composition root
    const supabase = createClient();

    // Identity provider (all platforms)
    const authProvider = createSupabaseAuthProvider(supabase);

    // Credential provider (web only)
    const credentialProvider = createSupabaseCredentialProvider(supabase);

    // OAuth provider (iOS only - null on web)
    const oauthProvider = null;

    // IOC INJECTION: Inject all providers into authApi singleton
    if (!isAuthApiInitialized()) {
      initAuthApi(authProvider, credentialProvider, oauthProvider);
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
