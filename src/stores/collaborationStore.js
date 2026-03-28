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
  onFullSync: null,
  onTerminalSnapshot: null,
  onTerminalLockRequest: null,
  onTerminalLockGrant: null,

  setCollaborators: (collaborators) => set({ collaborators }),
  setCursors: (cursors) => set({ cursors }),

  joinCollaboration: async (sessionId, user) => {
    const existing = get().channel;
    if (existing) {
      set({ channel: null });
      existing.unsubscribe().catch(console.error);
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
        const uniqueUsers = new Map();

        Object.values(state)
          .flat()
          .forEach((p) => {
            if (!uniqueUsers.has(p.user_id)) {
              uniqueUsers.set(p.user_id, {
                id: p.user_id,
                name: p.display_name,
                color: p.color,
              });
            }
          });

        set({ collaborators: Array.from(uniqueUsers.values()) });
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
              path: payload.path,
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
                path: payload.path,
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
          cb(payload.changes, payload.userId, payload.path);
        }
      })
      .on("broadcast", { event: "full-sync" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        const cb = get().onFullSync;
        if (cb) {
          cb(payload.content, payload.userId, payload.path);
        }
      })
      .on("broadcast", { event: "fs-change" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        const cb = get().onFileSystemChange;
        if (cb) {
          cb(payload.fs, payload.userId);
        }
      })
      .on("broadcast", { event: "terminal-state" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        const cb = get().onTerminalSnapshot;
        if (cb && payload.snapshot) {
          cb(payload.snapshot, payload.userId);
        }
      })
      .on("broadcast", { event: "terminal-lock-request" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        const cb = get().onTerminalLockRequest;
        if (cb && payload) {
          cb(payload);
        }
      })
      .on("broadcast", { event: "terminal-lock-grant" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        const cb = get().onTerminalLockGrant;
        if (cb && payload) {
          cb(payload);
        }
      });

    set({ channel });

    await channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const currentChannel = get().channel;
        if (currentChannel === channel) {
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
      }
    });

    return channel;
  },

  leaveCollaboration: async () => {
    const { channel } = get();
    if (channel) {
      set({ channel: null, collaborators: [], cursors: {}, lockedLines: {} });
      await channel.unsubscribe().catch(console.error);
    }
  },

  broadcastCursor: (userId, path, lineNumber, column, name) => {
    const { channel, userColor } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          userId,
          path,
          lineNumber,
          column,
          color: userColor,
          name,
        },
      });
    }
  },

  broadcastLineLock: (userId, path, lineNumber, name) => {
    const { channel, userColor } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "line-lock",
        payload: {
          userId,
          path,
          lineNumber,
          color: userColor,
          name,
        },
      });
    }
  },

  broadcastChanges: (userId, path, changes) => {
    const { channel } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "changes",
        payload: { userId, path, changes },
      });
    }
  },

  broadcastFullSync: (userId, path, content) => {
    const { channel } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "full-sync",
        payload: { userId, path, content },
      });
    }
  },

  broadcastFileSystemChange: (userId, fs) => {
    const { channel } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "fs-change",
        payload: { userId, fs },
      });
    }
  },

  getLockedLineByOther: (path, lineNumber, myUserId) => {
    const { lockedLines } = get();
    for (const [uid, lock] of Object.entries(lockedLines)) {
      if (uid !== myUserId && lock.path === path && lock.lineNumber === lineNumber) {
        return lock;
      }
    }
    return null;
  },

  setOnCodeChanges: (callback) => set({ onCodeChanges: callback }),
  setOnFullSync: (callback) => set({ onFullSync: callback }),
  setOnTerminalSnapshot: (callback) => set({ onTerminalSnapshot: callback }),
  setOnTerminalLockRequest: (callback) => set({ onTerminalLockRequest: callback }),
  setOnTerminalLockGrant: (callback) => set({ onTerminalLockGrant: callback }),

  broadcastTerminalSnapshot: (userId, snapshot) => {
    const { channel } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "terminal-state",
        payload: { userId, snapshot },
      });
    }
  },

  broadcastTerminalLockRequest: (payload) => {
    const { channel } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "terminal-lock-request",
        payload,
      });
    }
  },

  broadcastTerminalLockGrant: (payload) => {
    const { channel } = get();
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "terminal-lock-grant",
        payload,
      });
    }
  },

  onFileSystemChange: null,
  setOnFileSystemChange: (callback) => set({ onFileSystemChange: callback }),

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
