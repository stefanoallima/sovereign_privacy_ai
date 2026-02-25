import { create } from "zustand";

interface AuthStore {
  user: null;
  isInitialized: boolean;
  isOfflineMode: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

// Supabase removed — app always runs in local mode.
export const useAuthStore = create<AuthStore>()(() => ({
  user: null,
  isInitialized: true,
  isOfflineMode: true,
  initialize: async () => {},
  signOut: async () => {},
  clearError: () => {},
}));

export function useIsAuthenticated(): boolean {
  return true;
}

export function useRequireAuth(): { isReady: boolean; needsAuth: boolean } {
  return { isReady: true, needsAuth: false };
}
