import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const AI_CONFIG_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      loading: true,
      aiConfig: {
        useCustom: false,
        apiKey: "",
        model: "",
        savedAt: null,
      },

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setLoading: (loading) => set({ loading }),
      setAiConfig: (config) =>
        set((state) => ({
          aiConfig: { ...state.aiConfig, ...config },
        })),
      resetAiConfig: () =>
        set({
          aiConfig: { useCustom: false, apiKey: "", model: "", savedAt: null },
        }),
      isAiConfigExpired: () => {
        const { aiConfig } = get();
        if (!aiConfig.useCustom || !aiConfig.savedAt) return false;
        return Date.now() - aiConfig.savedAt > AI_CONFIG_TTL_MS;
      },

      signInWithEmail: async (email, password) => {
        if (!isSupabaseConfigured() || !supabase) {
          throw new Error("Supabase is not configured. Please connect a Supabase project first.");
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        set({ user: data.user, session: data.session });
        return data;
      },

      signUpWithEmail: async (email, password, displayName) => {
        if (!isSupabaseConfigured() || !supabase) {
          throw new Error("Supabase is not configured. Please connect a Supabase project first.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
            },
          },
        });
        if (error) throw error;
        set({ user: data.user, session: data.session });
        return data;
      },

      signInWithGithub: async () => {
        if (!isSupabaseConfigured() || !supabase) {
          throw new Error("Supabase is not configured. Please connect a Supabase project first.");
        }
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "github",
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        return data;
      },

      updateDisplayName: async (newName) => {
        if (!isSupabaseConfigured() || !supabase) {
          throw new Error("Supabase is not configured.");
        }

        const trimmed = newName.trim();
        if (!trimmed) {
          throw new Error("Display name cannot be empty.");
        }
        if (trimmed.length < 2) {
          throw new Error("Display name must be at least 2 characters.");
        }
        if (trimmed.length > 30) {
          throw new Error("Display name must be 30 characters or less.");
        }

        const currentUser = get().user;
        if (currentUser?.user_metadata?.display_name === trimmed) {
          throw new Error("This is already your current display name.");
        }

        // Check uniqueness against profiles table (skip if table missing)
        try {
          const { data: existing, error: lookupError } = await supabase
            .from("profiles")
            .select("id")
            .ilike("display_name", trimmed)
            .neq("id", currentUser.id)
            .limit(1);

          if (!lookupError && existing && existing.length > 0) {
            throw new Error("This display name is already taken. Please choose another.");
          }

          if (lookupError) {
            console.warn("Profiles table lookup skipped (table may not exist):", lookupError.message);
          }
        } catch (uniqueError) {
          // Re-throw "already taken" errors, swallow table-missing errors
          if (uniqueError.message.includes("already taken")) {
            throw uniqueError;
          }
          console.warn("Skipping uniqueness check:", uniqueError.message);
        }

        const { data, error } = await supabase.auth.updateUser({
          data: { display_name: trimmed },
        });
        if (error) throw error;

        // Sync to profiles table (best-effort, won't block update)
        try {
          await supabase
            .from("profiles")
            .upsert(
              { id: currentUser.id, display_name: trimmed, updated_at: new Date().toISOString() },
              { onConflict: "id" }
            );
        } catch (syncError) {
          console.warn("Profile sync skipped:", syncError.message);
        }

        set({ user: data.user });
        return data.user;
      },

      signOut: async () => {
        if (!isSupabaseConfigured() || !supabase) {
          set({ user: null, session: null, aiConfig: { useCustom: false, apiKey: "", model: "", savedAt: null } });
          return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        set({ user: null, session: null, aiConfig: { useCustom: false, apiKey: "", model: "", savedAt: null } });
      },

      initialize: async () => {
        if (!isSupabaseConfigured() || !supabase) {
          set({ loading: false });
          return;
        }
        try {
          set({ loading: true });

          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            set({ user: session.user, session, loading: false });
          } else {
            set({ loading: false });
          }

          supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && session) {
              set({ user: session.user, session, loading: false });
            } else if (event === "SIGNED_OUT") {
              set({ user: null, session: null, loading: false });
            } else if (event === "TOKEN_REFRESHED" && session) {
              // Only update session token, avoid replacing user reference
              // to prevent unnecessary re-renders of protected routes
              const currentUser = get().user;
              if (currentUser?.id !== session.user?.id) {
                set({ user: session.user, session });
              } else {
                set({ session });
              }
            }
          });
        } catch (error) {
          console.error("Auth initialization error:", error);
          set({ loading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ aiConfig: state.aiConfig }),
    }
  )
);
