import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface AuthStore {
  // State
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  clearError: () => void;

  // Offline mode
  isOfflineMode: boolean;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      session: null,
      isLoading: true,
      isInitialized: false,
      error: null,
      isOfflineMode: false,

      // Initialize auth state
      initialize: async () => {
        if (!isSupabaseConfigured()) {
          // No Supabase config - enable offline mode automatically
          set({
            isLoading: false,
            isInitialized: true,
            isOfflineMode: true,
            user: null,
            session: null
          });
          return;
        }

        try {
          // Get initial session
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            console.error("Auth initialization error:", error);
            set({ error: error.message });
          }

          set({
            user: session?.user || null,
            session: session,
            isLoading: false,
            isInitialized: true,
          });

          // Listen for auth changes
          supabase.auth.onAuthStateChange((_event, session) => {
            set({
              user: session?.user || null,
              session: session,
            });
          });
        } catch (err) {
          console.error("Failed to initialize auth:", err);
          set({
            isLoading: false,
            isInitialized: true,
            error: "Failed to connect to authentication service"
          });
        }
      },

      // Sign in with email/password
      signInWithEmail: async (email, password) => {
        set({ isLoading: true, error: null });

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          set({ isLoading: false, error: error.message });
          return { error };
        }

        set({
          user: data.user,
          session: data.session,
          isLoading: false,
          isOfflineMode: false,
        });

        return { error: null };
      },

      // Sign up new user
      signUp: async (email, password, name) => {
        set({ isLoading: true, error: null });

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

        if (error) {
          set({ isLoading: false, error: error.message });
          return { error };
        }

        // Note: User may need to verify email before session is active
        set({
          user: data.user,
          session: data.session,
          isLoading: false,
        });

        return { error: null };
      },

      // Sign out
      signOut: async () => {
        set({ isLoading: true });

        await supabase.auth.signOut();

        set({
          user: null,
          session: null,
          isLoading: false,
          error: null,
        });
      },

      // Reset password (send reset email)
      resetPassword: async (email) => {
        set({ isLoading: true, error: null });

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        set({ isLoading: false });

        if (error) {
          set({ error: error.message });
          return { error };
        }

        return { error: null };
      },

      // Update password (after reset)
      updatePassword: async (newPassword) => {
        set({ isLoading: true, error: null });

        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        set({ isLoading: false });

        if (error) {
          set({ error: error.message });
          return { error };
        }

        return { error: null };
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Offline mode (use app without account)
      enableOfflineMode: () => set({ isOfflineMode: true, isLoading: false }),
      disableOfflineMode: () => set({ isOfflineMode: false }),
    }),
    {
      name: "assistant-auth",
      partialize: (state) => ({
        isOfflineMode: state.isOfflineMode,
      }),
    }
  )
);

// Helper hook to check if user is authenticated or in offline mode
export function useIsAuthenticated(): boolean {
  const { user, isOfflineMode } = useAuthStore();
  return Boolean(user) || isOfflineMode;
}

// Helper hook to require authentication
export function useRequireAuth(): { isReady: boolean; needsAuth: boolean } {
  const { user, isLoading, isInitialized, isOfflineMode } = useAuthStore();

  return {
    isReady: isInitialized && !isLoading,
    needsAuth: isInitialized && !isLoading && !user && !isOfflineMode,
  };
}
