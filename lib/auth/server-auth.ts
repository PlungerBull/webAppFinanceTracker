/**
 * Server-Side Auth Utilities
 *
 * Provides IAuthProvider-compatible auth checks for Next.js Server Components.
 * These utilities use the server-side Supabase client and support the
 * CTO Mandate #6: Auth Provider Abstraction for Native Apple Sign-In.
 *
 * @module server-auth
 */

import { createClient } from '@/lib/supabase/server';
import { createSupabaseAuthProvider } from './supabase-auth-provider';
import type { IAuthProvider } from './auth-provider.interface';

/**
 * Create a server-side auth provider.
 *
 * IMPORTANT: This must be called within an async Server Component context
 * where cookies are available.
 *
 * @returns IAuthProvider for server-side use
 *
 * @example
 * ```typescript
 * // In a Server Component
 * export default async function DashboardPage() {
 *   const authProvider = await createServerAuthProvider();
 *   const isAuth = await authProvider.isAuthenticated();
 *   if (!isAuth) redirect('/login');
 *   // ...
 * }
 * ```
 */
export async function createServerAuthProvider(): Promise<IAuthProvider> {
  const supabase = await createClient();
  return createSupabaseAuthProvider(supabase);
}

/**
 * Server-side auth guard helper.
 *
 * Checks authentication and returns the user ID or null.
 * Use this for simpler page guards that just need to check auth status.
 *
 * @returns User ID string if authenticated, null otherwise
 *
 * @example
 * ```typescript
 * export default async function DashboardPage() {
 *   const userId = await getServerUserId();
 *   if (!userId) redirect('/login');
 *   // ...
 * }
 * ```
 */
export async function getServerUserId(): Promise<string | null> {
  try {
    const authProvider = await createServerAuthProvider();
    return await authProvider.getCurrentUserId();
  } catch {
    return null;
  }
}

/**
 * Server-side authentication check.
 *
 * @returns true if user is authenticated
 *
 * @example
 * ```typescript
 * export default async function Page() {
 *   if (!(await isServerAuthenticated())) {
 *     redirect('/login');
 *   }
 * }
 * ```
 */
export async function isServerAuthenticated(): Promise<boolean> {
  try {
    const authProvider = await createServerAuthProvider();
    return await authProvider.isAuthenticated();
  } catch {
    return false;
  }
}
