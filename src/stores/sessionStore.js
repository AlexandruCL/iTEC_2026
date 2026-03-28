import { create } from "zustand";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useCollaborationStore } from "@/stores/collaborationStore";

export const useSessionStore = create((set, get) => ({
  sessions: [],
  currentSession: null,
  loading: false,
  error: null,
  maxSessions: 3,

  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  fetchSessions: async (userId) => {
    if (!isSupabaseConfigured() || !supabase) {
      set({ loading: false, error: "Supabase is not configured." });
      return [];
    }
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      set({ sessions: data || [], loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createSession: async (userId, name, language = "javascript") => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error(
        "Supabase is not configured. Please connect a Supabase project first.",
      );
    }
    const { sessions, maxSessions } = get();
    if (sessions.length >= maxSessions) {
      throw new Error(
        `Maximum ${maxSessions} sessions allowed. Please delete a session first.`,
      );
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          user_id: userId,
          name,
          language,
          code: getDefaultCode(language),
          collaborators: [],
        })
        .select()
        .single();

      if (error) throw error;
      set({ sessions: [data, ...get().sessions], loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteSession: async (sessionId) => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error("Supabase is not configured.");
    }
    set({ loading: true, error: null });
    try {
      // Broadcast deletion via both channels that users might be subscribed to
      try {
        const collabChannel = supabase.channel(`session:${sessionId}`);
        const timelineChannel = supabase.channel(`timeline-events:${sessionId}`);
        await collabChannel.subscribe();
        await timelineChannel.subscribe();

        await collabChannel.send({
          type: "broadcast",
          event: "session-deleted",
          payload: { sessionId },
        });
        await timelineChannel.send({
          type: "broadcast",
          event: "session-deleted",
          payload: { sessionId },
        });

        // Give time for broadcast to reach all clients before deleting
        await new Promise((r) => setTimeout(r, 500));
        await collabChannel.unsubscribe();
        await timelineChannel.unsubscribe();
      } catch (broadcastErr) {
        console.warn("Failed to broadcast session deletion:", broadcastErr);
      }

      await supabase.from("session_timeline_events").delete().eq("session_id", sessionId);
      await supabase.from("session_timeline_snapshots").delete().eq("session_id", sessionId);

      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;
      set({
        sessions: get().sessions.filter((s) => s.id !== sessionId),
        loading: false,
      });
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateSessionFileSystem: async (sessionId, fileSystem) => {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ code: JSON.stringify(fileSystem), updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to update code:", error);
    }
  },

  joinSession: async (sessionId) => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error("Supabase is not configured.");
    }
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) throw error;
      set({ currentSession: data, loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  appendTimelineEvent: async ({
    sessionId,
    actorUserId,
    eventType,
    path = null,
    payload = {},
  }) => {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("session_timeline_events")
        .insert({
          session_id: sessionId,
          actor_user_id: actorUserId,
          event_type: eventType,
          path,
          payload,
        })
        .select("id, session_id, actor_user_id, event_type, path, payload, created_at")
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Failed to append timeline event:", error);
      return null;
    }
  },

  appendTimelineSnapshot: async ({ sessionId, eventId, fs }) => {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("session_timeline_snapshots")
        .insert({
          session_id: sessionId,
          event_id: eventId,
          fs,
        })
        .select("id, session_id, event_id, created_at")
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Failed to append timeline snapshot:", error);
      return null;
    }
  },

  fetchTimelineEvents: async (sessionId, limit = 2500) => {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("session_timeline_events")
        .select("id, session_id, actor_user_id, event_type, path, payload, created_at")
        .eq("session_id", sessionId)
        .order("id", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Failed to fetch timeline events:", error);
      return [];
    }
  },
}));

function getDefaultCode(language) {
  const templates = {
    javascript: `// Welcome to iTECify!\n// Start coding together in real-time\n\nfunction greet(name) {\n  return \`Hello, \${name}! Welcome to collaborative coding.\`;\n}\n\nconsole.log(greet("Developer"));\n`,
    typescript: `// Welcome to iTECify!\n// Start coding together in real-time\n\nfunction greet(name: string): string {\n  return \`Hello, \${name}! Welcome to collaborative coding.\`;\n}\n\nconsole.log(greet("Developer"));\n`,
    python: `# Welcome to iTECify!\n# Start coding together in real-time\n\ndef greet(name: str) -> str:\n    return f"Hello, {name}! Welcome to collaborative coding."\n\nprint(greet("Developer"))\n`,
    html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>iTECify</title>\n</head>\n<body>\n  <h1>Welcome to iTECify!</h1>\n  <p>Start coding together in real-time.</p>\n</body>\n</html>\n`,
  };

  const extMap = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    html: "html",
    css: "css",
  };
  const ext = extMap[language] || "txt";
  const fileName = `/main.${ext}`;
  const content = templates[language] || templates.javascript;

  const fs = {
    [fileName]: { type: "file", content },
  };

  return JSON.stringify(fs);
}
