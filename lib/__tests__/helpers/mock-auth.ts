/**
 * Mock Auth Provider Factory
 *
 * Provides reusable mock auth providers for testing services and hooks.
 * Use `@/` path aliases when importing this in tests.
 *
 * @example
 * ```typescript
 * import { createMockAuthProvider, DEFAULT_TEST_USER_ID } from '@/lib/__tests__/helpers';
 *
 * const mockAuth = createMockAuthProvider();
 * // User is authenticated by default
 *
 * const mockAuth = createMockAuthProvider({ authenticated: false });
 * // User is not authenticated
 * ```
 *
 * @module lib/__tests__/helpers/mock-auth
 */

import { vi } from 'vitest';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { AuthUserEntity, AuthSessionEntity } from '@/domain/auth';

/**
 * Default test user ID (consistent across tests)
 */
export const DEFAULT_TEST_USER_ID = 'test-user-123';

/**
 * Default test user email
 */
export const DEFAULT_TEST_USER_EMAIL = 'test@example.com';

/**
 * Options for creating a mock auth provider
 */
export interface MockAuthProviderOptions {
  /** Whether the user is authenticated (default: true) */
  authenticated?: boolean;
  /** Custom user ID (default: DEFAULT_TEST_USER_ID) */
  userId?: string;
  /** Custom user email (default: DEFAULT_TEST_USER_EMAIL) */
  email?: string;
  /** Custom first name */
  firstName?: string;
  /** Custom last name */
  lastName?: string;
}

/**
 * Mock auth provider return type
 */
export interface MockAuthProvider {
  provider: IAuthProvider;
  mockGetCurrentUserId: ReturnType<typeof vi.fn>;
  mockIsAuthenticated: ReturnType<typeof vi.fn>;
  mockSignOut: ReturnType<typeof vi.fn>;
  mockGetUser: ReturnType<typeof vi.fn>;
  mockGetSession: ReturnType<typeof vi.fn>;
  mockUpdateUserMetadata: ReturnType<typeof vi.fn>;
  mockOnAuthStateChange: ReturnType<typeof vi.fn>;
  /** Helper to simulate sign-in during test */
  simulateSignIn: (userId?: string) => void;
  /** Helper to simulate sign-out during test */
  simulateSignOut: () => void;
}

/**
 * Create a mock auth provider for testing
 *
 * @param options - Configuration options
 * @returns Mock provider with all mock functions exposed
 *
 * @example
 * ```typescript
 * // Authenticated user (default)
 * const { provider } = createMockAuthProvider();
 * await provider.getCurrentUserId(); // Returns 'test-user-123'
 *
 * // Unauthenticated user
 * const { provider } = createMockAuthProvider({ authenticated: false });
 * await provider.getCurrentUserId(); // Throws AuthenticationError
 *
 * // Custom user
 * const { provider } = createMockAuthProvider({
 *   userId: 'custom-user',
 *   email: 'custom@test.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 * });
 * ```
 */
export function createMockAuthProvider(options: MockAuthProviderOptions = {}): MockAuthProvider {
  const {
    authenticated = true,
    userId = DEFAULT_TEST_USER_ID,
    email = DEFAULT_TEST_USER_EMAIL,
    firstName = 'Test',
    lastName = 'User',
  } = options;

  let isAuthenticated = authenticated;
  let currentUserId = userId;

  const mockUser: AuthUserEntity = {
    id: userId,
    email,
    firstName,
    lastName,
    createdAt: new Date().toISOString(),
  };

  const mockSession: AuthSessionEntity = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 3600000, // 1 hour from now
    user: mockUser,
  };

  const mockGetCurrentUserId = vi.fn().mockImplementation(async () => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }
    return currentUserId;
  });

  const mockIsAuthenticated = vi.fn().mockImplementation(async () => isAuthenticated);

  const mockSignOut = vi.fn().mockImplementation(async () => {
    isAuthenticated = false;
  });

  const mockGetUser = vi.fn().mockImplementation(async () => {
    return isAuthenticated ? { ...mockUser, id: currentUserId } : null;
  });

  const mockGetSession = vi.fn().mockImplementation(async () => {
    return isAuthenticated ? { ...mockSession, user: { ...mockUser, id: currentUserId } } : null;
  });

  const mockUpdateUserMetadata = vi.fn().mockResolvedValue(undefined);

  const mockOnAuthStateChange = vi.fn().mockImplementation(() => {
    // Return unsubscribe function
    return () => {};
  });

  const provider: IAuthProvider = {
    getCurrentUserId: mockGetCurrentUserId,
    isAuthenticated: mockIsAuthenticated,
    signOut: mockSignOut,
    getUser: mockGetUser,
    getSession: mockGetSession,
    updateUserMetadata: mockUpdateUserMetadata,
    onAuthStateChange: mockOnAuthStateChange,
  };

  return {
    provider,
    mockGetCurrentUserId,
    mockIsAuthenticated,
    mockSignOut,
    mockGetUser,
    mockGetSession,
    mockUpdateUserMetadata,
    mockOnAuthStateChange,
    simulateSignIn: (newUserId?: string) => {
      isAuthenticated = true;
      if (newUserId) {
        currentUserId = newUserId;
      }
    },
    simulateSignOut: () => {
      isAuthenticated = false;
    },
  };
}
