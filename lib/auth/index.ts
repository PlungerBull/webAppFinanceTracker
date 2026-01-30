/**
 * Auth Provider Exports
 *
 * Centralized exports for auth provider abstraction.
 *
 * @module auth-provider
 */

// Interface and error classes
export * from './auth-provider.interface';

// Supabase implementation
export * from './supabase-auth-provider';

// Server-side helpers
export * from './server-auth';

// Re-export domain types for convenience
export type {
  AuthUserEntity,
  AuthSessionEntity,
  AuthEventType,
  AuthStateChangeCallback,
  AuthUnsubscribe,
} from '@/domain/auth';

export { getDisplayName, hasEmail, hasFullName } from '@/domain/auth';
