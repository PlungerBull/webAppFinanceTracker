import { create } from 'zustand';
import type { AuthUserEntity } from '@/domain/auth';
import { getAuthApi, isAuthApiInitialized } from '@/features/auth/api/auth';

/**
 * Auth Store State
 *
 * Uses platform-agnostic AuthUserEntity instead of Supabase User.
 */
interface AuthStoreState {
  user: AuthUserEntity | null;
  loading: boolean;
  initialized: boolean;
}

interface AuthStoreActions {
  setUser: (user: AuthUserEntity | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
}

type AuthStore = AuthStoreState & AuthStoreActions;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),

  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    // Guard: authApi must be initialized first (done in AuthProvider)
    if (!isAuthApiInitialized()) {
      console.warn('Auth store initialize called before authApi initialized');
      set({ user: null, loading: false, initialized: true });
      return;
    }

    try {
      set({ loading: true });
      const user = await getAuthApi().getUser();
      set({ user, loading: false, initialized: true });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({ user: null, loading: false, initialized: true });
    }
  },

  logout: async () => {
    if (!isAuthApiInitialized()) {
      throw new Error('Auth API not initialized');
    }

    try {
      await getAuthApi().logout();
      set({ user: null });
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  },
}));
