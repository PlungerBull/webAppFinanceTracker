/**
 * Client-Safe Auth Exports
 *
 * This module provides auth utilities safe for use in Client Components.
 * For Server Component auth guards, use '@/lib/auth/server' instead.
 *
 * @module auth/client
 */

// ============================================================================
// AUTH API (Singleton Facade) - Client Safe
// ============================================================================

export {
  type AuthApi,
  createAuthApi,
  initAuthApi,
  getAuthApi,
  isAuthApiInitialized,
} from './auth-api';

// ============================================================================
// INTERFACES - Client Safe
// ============================================================================

export * from './auth-provider.interface';
export * from './credential-auth-provider.interface';
export * from './oauth-auth-provider.interface';

// ============================================================================
// IMPLEMENTATIONS - Client Safe
// ============================================================================

export * from './supabase-auth-provider';
export * from './supabase-credential-provider';

// ============================================================================
// RE-EXPORTED DOMAIN TYPES - Client Safe
// ============================================================================

export type {
  AuthUserEntity,
  AuthSessionEntity,
  AuthEventType,
  AuthStateChangeCallback,
  AuthUnsubscribe,
  AuthMethod,
  SignInResult,
  SignUpResult,
  CredentialErrorCode,
  CredentialAuthError,
  OAuthErrorCode,
  OAuthAuthError,
  OAuthSignInData,
} from '@/domain/auth';

export { getDisplayName, hasEmail, hasFullName } from '@/domain/auth';
