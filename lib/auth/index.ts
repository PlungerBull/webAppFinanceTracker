/**
 * Auth Provider Exports
 *
 * Centralized exports for auth provider abstraction.
 *
 * @module auth-provider
 */

// ============================================================================
// INTERFACES
// ============================================================================

// Identity provider interface (all platforms)
export * from './auth-provider.interface';

// Credential provider interface (web only)
export * from './credential-auth-provider.interface';

// OAuth provider interface (iOS primarily)
export * from './oauth-auth-provider.interface';

// ============================================================================
// IMPLEMENTATIONS
// ============================================================================

// Supabase identity provider
export * from './supabase-auth-provider';

// Supabase credential provider
export * from './supabase-credential-provider';

// ============================================================================
// SERVER-SIDE HELPERS
// ============================================================================

export * from './server-auth';

// ============================================================================
// RE-EXPORTED DOMAIN TYPES
// ============================================================================

export type {
  // User and session entities
  AuthUserEntity,
  AuthSessionEntity,
  AuthEventType,
  AuthStateChangeCallback,
  AuthUnsubscribe,
  // Auth method types
  AuthMethod,
  SignInResult,
  SignUpResult,
  // Error types
  CredentialErrorCode,
  CredentialAuthError,
  OAuthErrorCode,
  OAuthAuthError,
  OAuthSignInData,
} from '@/domain/auth';

export { getDisplayName, hasEmail, hasFullName } from '@/domain/auth';
