import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { generateColor } from "@/lib/utils";

export const useCollaborationStore = create((set, get) => ({
  collaborators: [],
  cursors: {},
  lockedLines: {},
  channel: null,
  userColor: generateColor(),
  onCodeChanges: null,

  setCollaborators: (collaborators) => set({ collaborators }),
  setCursors: (cursors) => set({ cursors }),

  joinCollaboration: async (sessionId, user) => {
    const existing = get().channel;
    if (existing) {
      await existing.unsubscribe();
    }

    const { userColor } = get();
    const channel = supabase.channel(`session:${sessionId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const collaborators = Object.values(state)
          .flat()
          .map((p) => ({
            id: p.user_id,
            name: p.display_name,
            color: p.color,
          }));
        set({ collaborators });
      })
      .on("presence", { event: "join" }, ({ key }) => {
        console.log("User joined:", key);
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        console.log("User left:", key);
        const updatedCursors = { ...get().cursors };
        delete updatedCursors[key];
        const updatedLocks = { ...get().lockedLines };
        delete updatedLocks[key];
        set({ cursors: updatedCursors, lockedLines: updatedLocks });
      })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        set({
          cursors: {
            ...get().cursors,
            [payload.userId]: {
              lineNumber: payload.lineNumber,
              column: payload.column,
              color: payload.color,
              name: payload.name,
            },
          },
        });
      })
      .on("broadcast", { event: "line-lock" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        if (payload.lineNumber === null) {
          const updatedLocks = { ...get().lockedLines };
          delete updatedLocks[payload.userId];
          set({ lockedLines: updatedLocks });
        } else {
          set({
            lockedLines: {
              ...get().lockedLines,
              [payload.userId]: {
                lineNumber: payload.lineNumber,
                color: payload.color,
                name: payload.name,
              },
            },
          });
        }
      })
      .on("broadcast", { event: "changes" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        const cb = get().onCodeChanges;
        if (cb) {
          cb(payload.changes, payload.userId);
        }
      })
      ;

    await channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: user.id,
          display_name:
            user.user_metadata?.display_name ||
            user.email?.split("@")[0] ||
            "Anonymous",
          color: userColor,
          online_at: new Date().toISOString(),
        });
      }
    });

    set({ channel });
    return channel;
  },

  leaveCollaboration: async () => {
    const { channel } = get();
    if (channel) {
      await channel.unsubscribe();
      set({ channel: null, collaborators: [], cursors: {}, lockedLines: {} });
    }
  },

  broadcastCursor: (userId, lineNumber, column, name) => {
    const { channel, userColor } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          userId,
          lineNumber,
          column,
          color: userColor,
          name,
        },
      });
    }
  },

  broadcastLineLock: (userId, lineNumber, name) => {
    const { channel, userColor } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "line-lock",
        payload: {
          userId,
          lineNumber,
          color: userColor,
          name,
        },
      });
    }
  },

  broadcastChanges: (userId, changes) => {
    const { channel } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "changes",
        payload: { userId, changes },
      });
    }
  },

  getLockedLineByOther: (lineNumber, myUserId) => {
    const { lockedLines } = get();
    for (const [uid, lock] of Object.entries(lockedLines)) {
      if (uid !== myUserId && lock.lineNumber === lineNumber) {
        return lock;
      }
    }
    return null;
  },

  setOnCodeChanges: (callback) => set({ onCodeChanges: callback }),

  onSessionDeleted: null,
  setOnSessionDeleted: (callback) => set({ onSessionDeleted: callback }),

  broadcastSessionDeleted: () => {
    const { channel } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "session-deleted",
        payload: {},
      });
    }
  },
}));
