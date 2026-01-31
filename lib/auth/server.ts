/**
 * Server-Only Auth Exports
 *
 * This module provides auth utilities for Server Components only.
 * DO NOT import this in Client Components - use '@/lib/auth/client' instead.
 *
 * The 'server-only' import ensures a build error if accidentally imported
 * in a Client Component.
 *
 * @module auth/server
 */

import 'server-only';

// ============================================================================
// SERVER-SIDE AUTH HELPERS
// ============================================================================

export {
  createServerAuthProvider,
  getServerUserId,
  isServerAuthenticated,
} from './server-auth';
