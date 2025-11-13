import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { authApi } from '@/features/auth/api/auth';
import type { AuthState } from '@/types/auth.types';

interface AuthStore extends AuthState {
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),

  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    try {
      set({ loading: true });
      const user = await authApi.getUser();
      set({ user, loading: false, initialized: true });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({ user: null, loading: false, initialized: true });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
      set({ user: null });
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  },
}));
