/**
 * Auth Module - Type Exports Only
 *
 * This barrel file exports ONLY types and interfaces.
 *
 * For runtime imports:
 * - Client Components: import from '@/lib/auth/client'
 * - Server Components: import from '@/lib/auth/server'
 *
 * @module auth
 */

// ============================================================================
// INTERFACES (Type-only exports - safe for both client and server)
// ============================================================================

export type { IAuthProvider } from './auth-provider.interface';
export { AuthenticationError } from './auth-provider.interface';

export type {
  ICredentialAuthProvider,
  CredentialSignUpData,
  CredentialSignInData,
  ResetPasswordData,
  UpdatePasswordData,
  ChangePasswordData,
  ChangeEmailData,
} from './credential-auth-provider.interface';

export type { IOAuthAuthProvider, OAuthProvider } from './oauth-auth-provider.interface';

export type { AuthApi } from './auth-api';

// ============================================================================
// RE-EXPORTED DOMAIN TYPES
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
