import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { storeTokens, clearTokens } from '../services/api';

interface User {
  id: string;
  email: string;
  username: string;
  country: string | null;
  wins: number;
  losses: number;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User) => void;
  setTokensAndUser: (access: string, refresh: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  setTokensAndUser: async (access, refresh, user) => {
    await storeTokens(access, refresh);
    await SecureStore.setItemAsync('phylo_user', JSON.stringify(user));
    set({ user });
  },

  logout: async () => {
    await clearTokens();
    await SecureStore.deleteItemAsync('phylo_user');
    set({ user: null });
  },

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync('phylo_user');
      if (raw) {
        const user = JSON.parse(raw) as User;
        set({ user, isLoading: false });
        return;
      }
    } catch { /* */ }
    set({ isLoading: false });
  },
}));
