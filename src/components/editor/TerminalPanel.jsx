import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Square,
  Trash2,
  ChevronDown,
  Terminal as TerminalIcon,
  Loader2,
  Plus,
  Lock,
  Unlock,
  Clock3,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useCollaborationStore } from "@/stores/collaborationStore";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

const RUNNABLE_LANGUAGES = ["javascript", "python"];
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8787";
const MAX_TERMINAL_LINES = 1500;
const MAX_LINES_PER_EVENT = 200;
const MAX_LINE_LENGTH = 2000;
const LOCK_HEARTBEAT_MS = 4000;
const LOCK_STALE_MS = 12000;
const TERMINAL_STORAGE_PREFIX = "itec-terminal-state";
const BRAINROT_PATTERN = /(^|[^0-9])6(?:[\s\W_])*7(?=[^0-9]|$)/;
const BRAINROT_AUDIO_COOLDOWN_MS = 1200;
const BRAINROT_AUDIO_URL =
  "https://mgmwkptgjpfqayqixcnf.supabase.co/storage/v1/object/public/easter-eggs/67.mp3";

function formatTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const BUILTIN_COMMANDS = {
  help: () => [
    { text: "Available commands:", type: "system" },
    { text: "  help          Show this help message", type: "log" },
    { text: "  clear         Clear the active terminal", type: "log" },
    { text: "  echo <text>   Print text to output", type: "log" },
    { text: "  whoami        Show current user", type: "log" },
    { text: "  date          Show current date/time", type: "log" },
    { text: "  run           Execute current editor code", type: "log" },
    { text: "  stop          Stop current execution", type: "log" },
    { text: "  lock          Acquire lock on terminal", type: "log" },
    { text: "  unlock        Release terminal lock", type: "log" },
  ],
  whoami: () => [{ text: "developer@itecify", type: "log" }],
  date: () => [{ text: new Date().toString(), type: "log" }],
};

function createWelcomeLine() {
  return {
    id: `welcome-${Date.now()}-${Math.random()}`,
    text: "iTECify Shared Terminal v2.0 - Type 'help' for available commands",
    type: "system",
    time: formatTimestamp(),
  };
}

function createTerminal(index, ownerName) {
  const now = Date.now();
  return {
    id: `terminal-${now}-${Math.floor(Math.random() * 100000)}`,
    name: `Terminal ${index}`,
    lines: [createWelcomeLine()],
    commandHistory: [],
    isRunning: false,
    activeExecutionId: null,
    lockOwnerId: null,
    lockOwnerName: ownerName || "Unknown",
    lockToken: null,
    createdAt: now,
    createdByName: ownerName || "Unknown",
    createdById: null,
    isSnippetTerminal: false,
    retainLockAfterRun: false,
    lastActivityAt: now,
    lastHeartbeatAt: null,
    updatedAt: now,
  };
}

function sanitizeLines(newLines) {
  const time = formatTimestamp();
  return newLines.map((line, i) => {
    const rawText =
      typeof line.text === "string" && line.text.length > MAX_LINE_LENGTH
        ? `${line.text.slice(0, MAX_LINE_LENGTH)} ...[truncated]`
        : line.text;
    return {
      id: `${Date.now()}-${i}-${Math.random()}`,
      text: rawText,
      type: line.type || "log",
      time: i === 0 ? time : "",
      hasBrainrot: hasBrainrotToken(rawText),
    };
  });
}

function normalizeTerminal(terminal) {
  const now = Date.now();
  return {
    ...terminal,
    createdAt: terminal.createdAt || now,
    createdByName:
      terminal.createdByName || terminal.lockOwnerName || "Unknown",
    createdById: terminal.createdById || null,
    isSnippetTerminal: terminal.isSnippetTerminal || false,
    retainLockAfterRun: terminal.retainLockAfterRun || false,
    lastActivityAt: terminal.lastActivityAt || terminal.updatedAt || now,
    lockToken: terminal.lockToken || null,
    lastHeartbeatAt: terminal.lastHeartbeatAt || null,
  };
}

function formatRelativeTime(ts) {
  if (!ts) return "n/a";
  const diff = Date.now() - ts;
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function hasBrainrotToken(value) {
  if (typeof value !== "string") return false;
  return BRAINROT_PATTERN.test(value);
}

// Renders terminal text with digits 6 and 7 visually highlighted when the
// line contains a brainrot 67 pattern. Only active on flagged lines so
// normal output pays zero cost.
function renderHighlighted67(text) {
  if (typeof text !== "string" || !text) return text;

  const parts = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === "6" || text[i] === "7") {
      parts.push(
        <span
          key={`hl-${i}`}
          className="text-yellow-300 font-bold drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]"
          style={{ textShadow: "0 0 8px rgba(250,204,21,0.7), 0 0 2px rgba(250,204,21,0.9)" }}
        >
          {text[i]}
        </span>,
      );
      i += 1;
    } else {
      // Batch consecutive non-highlighted characters into one text node
      let end = i + 1;
      while (end < text.length && text[end] !== "6" && text[end] !== "7") {
        end += 1;
      }
      parts.push(text.slice(i, end));
      i = end;
    }
  }

  return parts;
}

const TerminalPanel = forwardRef(function TerminalPanel(
  { language, code, hostUserId, sessionId, isOpen, onToggle },
  ref,
) {
  const jumpscareImageUrl =
    "https://mgmwkptgjpfqayqixcnf.supabase.co/storage/v1/object/public/easter-eggs/jumpscare.jpeg";

  const user = useAuthStore((state) => state.user);
  const setOnTerminalSnapshot = useCollaborationStore(
    (state) => state.setOnTerminalSnapshot,
  );
  const broadcastTerminalSnapshot = useCollaborationStore(
    (state) => state.broadcastTerminalSnapshot,
  );
  const setOnTerminalLockRequest = useCollaborationStore(
    (state) => state.setOnTerminalLockRequest,
  );
  const setOnTerminalLockGrant = useCollaborationStore(
    (state) => state.setOnTerminalLockGrant,
  );
  const broadcastTerminalLockRequest = useCollaborationStore(
    (state) => state.broadcastTerminalLockRequest,
  );
  const broadcastTerminalLockGrant = useCollaborationStore(
    (state) => state.broadcastTerminalLockGrant,
  );
  const collaborators = useCollaborationStore((state) => state.collaborators);

  const [terminals, setTerminals] = useState([]);
  const [activeTerminalId, setActiveTerminalId] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [panelHeight, setPanelHeight] = useState(240);
  const [showJumpscare, setShowJumpscare] = useState(false);
  const [jumpscareAudioUrl, setJumpscareAudioUrl] = useState(
    "https://www.myinstants.com/media/sounds/fnaf-1-jumpscare-sound.mp3",
  );

  const inputRef = useRef(null);
  const outputEndRef = useRef(null);
  const audioRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const socketsRef = useRef(new Map());
  const suppressNextBroadcastRef = useRef(false);
  const terminalsRef = useRef([]);
  const activeTerminalIdRef = useRef(null);
  const isAuthoritativeHostRef = useRef(false);
  const userIdRef = useRef(null);
  const brainrotAudioRef = useRef(null);
  const lastBrainrotPlayRef = useRef(0);
  const brainrotCanAutoplayRef = useRef(false);
  // Holds the trailing characters of the previous stdout/stderr chunk
  // so we can detect a 67 pattern split across two WebSocket messages.
  const pendingBrainrotBufferRef = useRef(new Map());

  useEffect(() => {
    terminalsRef.current = terminals;
  }, [terminals]);

  // Pre-load audio into RAM for zero-latency jumpscare playback
  useEffect(() => {
    fetch("https://www.myinstants.com/media/sounds/fnaf-1-jumpscare-sound.mp3")
      .then((res) => res.blob())
      .then((blob) => {
        setJumpscareAudioUrl(URL.createObjectURL(blob));
      })
      .catch(() => { });
  }, []);

  // Pre-load 67 sound and unlock playback after first user interaction.
  useEffect(() => {
    const audio = new Audio(BRAINROT_AUDIO_URL);
    audio.preload = "auto";
    brainrotAudioRef.current = audio;

    const unlock = () => {
      const current = brainrotAudioRef.current;
      if (!current || brainrotCanAutoplayRef.current) return;

      current.volume = 0;
      const p = current.play();
      if (p?.then) {
        p
          .then(() => {
            current.pause();
            current.currentTime = 0;
            current.volume = 1;
            brainrotCanAutoplayRef.current = true;
          })
          .catch(() => {
            current.volume = 1;
          });
      } else {
        current.pause();
        current.currentTime = 0;
        current.volume = 1;
        brainrotCanAutoplayRef.current = true;
      }
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      if (brainrotAudioRef.current) {
        brainrotAudioRef.current.pause();
        brainrotAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    activeTerminalIdRef.current = activeTerminalId;
  }, [activeTerminalId]);

  const displayName =
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Anonymous";

  const collaboratorNameById = useMemo(() => {
    const map = new Map();
    collaborators.forEach((collaborator) => {
      if (collaborator?.id && collaborator?.name) {
        map.set(collaborator.id, collaborator.name);
      }
    });
    if (user?.id) {
      map.set(user.id, displayName);
    }
    return map;
  }, [collaborators, displayName, user?.id]);

  const isRunnable = RUNNABLE_LANGUAGES.includes(language);

  const activeTerminal = useMemo(
    () => terminals.find((t) => t.id === activeTerminalId) || null,
    [terminals, activeTerminalId],
  );

  const terminalStorageKey = useMemo(() => {
    if (!sessionId) return null;
    return `${TERMINAL_STORAGE_PREFIX}:${sessionId}`;
  }, [sessionId]);

  const resolvedHostId = useMemo(() => {
    if (!user?.id) return null;

    const presentIds = new Set(collaborators.map((c) => c.id));
    presentIds.add(user.id);

    if (hostUserId && presentIds.has(hostUserId)) {
      return hostUserId;
    }

    return (
      Array.from(presentIds).sort((a, b) => a.localeCompare(b))[0] || user.id
    );
  }, [collaborators, hostUserId, user?.id]);

  const isAuthoritativeHost = user?.id && resolvedHostId === user.id;

  useEffect(() => {
    isAuthoritativeHostRef.current = !!isAuthoritativeHost;
  }, [isAuthoritativeHost]);

  useEffect(() => {
    userIdRef.current = user?.id || null;
  }, [user?.id]);

  const isLockedByOther =
    !!activeTerminal?.lockOwnerId && activeTerminal.lockOwnerId !== user?.id;

  const canControlActiveTerminal = !activeTerminal
    ? false
    : !activeTerminal.lockOwnerId || activeTerminal.lockOwnerId === user?.id;

  const applyAndMaybeBroadcast = useCallback(
    (nextTerminals, nextActiveId, shouldBroadcast = true) => {
      setTerminals(nextTerminals);
      setActiveTerminalId(nextActiveId);

      if (shouldBroadcast && user?.id) {
        broadcastTerminalSnapshot(user.id, {
          terminals: nextTerminals,
          activeTerminalId: nextActiveId,
          updatedAt: Date.now(),
        });
      }
    },
    [broadcastTerminalSnapshot, user?.id],
  );

  const updateTerminal = useCallback(
    (terminalId, updater, shouldBroadcast = true) => {
      setTerminals((prev) => {
        const next = prev.map((terminal) =>
          terminal.id === terminalId
            ? { ...updater(terminal), updatedAt: Date.now() }
            : terminal,
        );

        if (shouldBroadcast && user?.id) {
          broadcastTerminalSnapshot(user.id, {
            terminals: next,
            activeTerminalId: activeTerminalIdRef.current,
            updatedAt: Date.now(),
          });
        }

        return next;
      });
    },
    [broadcastTerminalSnapshot, user?.id],
  );

  const addLines = useCallback(
    (terminalId, newLines, shouldBroadcast = true) => {
      const shouldTriggerBrainrot = (newLines || []).some((line) =>
        hasBrainrotToken(line?.text),
      );

      if (shouldTriggerBrainrot) {
        const now = Date.now();
        if (now - lastBrainrotPlayRef.current >= BRAINROT_AUDIO_COOLDOWN_MS) {
          lastBrainrotPlayRef.current = now;

          const audio = brainrotAudioRef.current || new Audio(BRAINROT_AUDIO_URL);
          brainrotAudioRef.current = audio;

          try {
            audio.currentTime = 0;
            audio.volume = 1;
            audio.play().catch(() => { });
          } catch {
            // Ignore playback errors.
          }
        }
      }

      const prepared = sanitizeLines(newLines);

      updateTerminal(
        terminalId,
        (terminal) => {
          const merged = [...terminal.lines, ...prepared];
          const capped =
            merged.length > MAX_TERMINAL_LINES
              ? merged.slice(-MAX_TERMINAL_LINES)
              : merged;

          return {
            ...terminal,
            lines: capped,
            lastActivityAt: Date.now(),
          };
        },
        shouldBroadcast,
      );
    },
    [updateTerminal],
  );

  const cleanupSocket = useCallback((terminalId) => {
    const ws = socketsRef.current.get(terminalId);
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
      socketsRef.current.delete(terminalId);
    }
  }, []);

  const isLockStale = useCallback((terminal) => {
    if (!terminal?.lockOwnerId) return false;
    if (!terminal.lastHeartbeatAt) return false;
    return Date.now() - terminal.lastHeartbeatAt > LOCK_STALE_MS;
  }, []);

  const releaseLock = useCallback(
    (terminalId, force = false) => {
      if (!user?.id) return;

      updateTerminal(
        terminalId,
        (terminal) => {
          const canRelease = terminal.lockOwnerId === user.id;
          if (!canRelease) return terminal;
          if (!force && terminal.isRunning) return terminal;

          return {
            ...terminal,
            lockOwnerId: null,
            lockOwnerName: null,
            lockToken: null,
            lastHeartbeatAt: null,
            lastActivityAt: Date.now(),
          };
        },
        true,
      );
    },
    [updateTerminal, user?.id],
  );

  const acquireLock = useCallback(
    (terminalId) => {
      if (!user?.id) return "denied";
      const terminal = terminalsRef.current.find((t) => t.id === terminalId);
      if (!terminal) return "denied";

      const stale = isLockStale(terminal);
      const token = `${user.id}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      if (!isAuthoritativeHost && terminal.lockOwnerId !== user.id) {
        broadcastTerminalLockRequest({
          userId: user.id,
          userName: displayName,
          terminalId,
          requestToken: token,
          requestedAt: Date.now(),
        });
        return "requested";
      }

      if (terminal.lockOwnerId && terminal.lockOwnerId !== user.id && !stale) {
        return "denied";
      }

      updateTerminal(
        terminalId,
        (current) => ({
          ...current,
          lockOwnerId: user.id,
          lockOwnerName: displayName,
          lockToken: token,
          lastHeartbeatAt: Date.now(),
          lastActivityAt: Date.now(),
        }),
        true,
      );

      if (isAuthoritativeHost) {
        broadcastTerminalLockGrant({
          userId: user.id,
          toUserId: user.id,
          toUserName: displayName,
          terminalId,
          approved: true,
          lockToken: token,
          grantedAt: Date.now(),
        });
      }

      return "acquired";
    },
    [
      broadcastTerminalLockGrant,
      broadcastTerminalLockRequest,
      displayName,
      isAuthoritativeHost,
      isLockStale,
      updateTerminal,
      user?.id,
    ],
  );

  const stopExecution = useCallback(
    async (terminalId) => {
      const terminal = terminalsRef.current.find((t) => t.id === terminalId);
      if (!terminal) return;

      const lockOutcome = acquireLock(terminalId);
      if (lockOutcome !== "acquired") {
        addLines(terminalId, [
          {
            text:
              lockOutcome === "requested"
                ? "Lock requested. Try again once granted."
                : "Terminal is locked by another collaborator",
            type: "warn",
          },
        ]);
        return;
      }

      if (!terminal.activeExecutionId) {
        addLines(terminalId, [
          { text: "No active execution to stop", type: "muted" },
        ]);
        return;
      }

      try {
        await fetch(
          `${BACKEND_URL}/v1/executions/${terminal.activeExecutionId}/stop`,
          {
            method: "POST",
          },
        );
        addLines(terminalId, [{ text: "Stop requested", type: "system" }]);
      } catch (error) {
        addLines(terminalId, [
          { text: `Failed to stop execution: ${error.message}`, type: "error" },
        ]);
      }
    },
    [acquireLock, addLines],
  );

  const sendRuntimeInput = useCallback(
    async (terminalId, input) => {
      const terminal = terminalsRef.current.find((t) => t.id === terminalId);
      if (!terminal?.activeExecutionId) return;

      const lockOutcome = acquireLock(terminalId);
      if (lockOutcome !== "acquired") {
        addLines(terminalId, [
          {
            text:
              lockOutcome === "requested"
                ? "Lock requested. Try again once granted."
                : "Terminal is locked by another collaborator",
            type: "warn",
          },
        ]);
        return;
      }

      addLines(terminalId, [{ text: `> ${input}`, type: "input" }]);

      try {
        const response = await fetch(
          `${BACKEND_URL}/v1/executions/${terminal.activeExecutionId}/input`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ input }),
          },
        );

        const body = await response.json();
        if (!response.ok || !body.accepted) {
          throw new Error(body?.error || body?.reason || "stdin not accepted");
        }
      } catch (error) {
        addLines(terminalId, [
          { text: `Failed to send input: ${error.message}`, type: "error" },
        ]);
      }
    },
    [acquireLock, addLines],
  );

  const executeCode = useCallback(
    (terminalId, codeOverride = null, runMode = "full") => {
      const terminal = terminalsRef.current.find((t) => t.id === terminalId);
      if (!terminal) return;

      const codeToRun = typeof codeOverride === "string" ? codeOverride : code;

      if (!isRunnable) {
        addLines(terminalId, [
          {
            text: `${language} execution is not supported yet. Use JavaScript or Python.`,
            type: "warn",
          },
        ]);
        return;
      }

      const lockOutcome = acquireLock(terminalId);
      if (lockOutcome !== "acquired") {
        addLines(terminalId, [
          {
            text:
              lockOutcome === "requested"
                ? "Lock requested. Try again once granted."
                : "Terminal is locked by another collaborator",
            type: "warn",
          },
        ]);
        return;
      }

      if (terminal.isRunning) {
        addLines(terminalId, [
          { text: "Execution already running", type: "warn" },
        ]);
        return;
      }

      updateTerminal(
        terminalId,
        (current) => ({
          ...current,
          isRunning: true,
          retainLockAfterRun: true,
          lockOwnerId: user?.id || null,
          lockOwnerName: displayName,
          lastHeartbeatAt: Date.now(),
        }),
        true,
      );

      addLines(terminalId, [
        {
          text:
            runMode === "snippet"
              ? `Running selected ${language} snippet...`
              : `Running ${language}...`,
          type: "system",
        },
      ]);

      cleanupSocket(terminalId);

      fetch(`${BACKEND_URL}/v1/executions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language,
          code: codeToRun,
        }),
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body?.error || "Failed to start execution");
          }

          const executionId = body.executionId;

          updateTerminal(
            terminalId,
            (current) => ({
              ...current,
              activeExecutionId: executionId,
            }),
            true,
          );

          const wsBase = BACKEND_URL.replace(/^http/i, "ws");
          const ws = new WebSocket(
            `${wsBase}/v1/executions/${executionId}/stream`,
          );
          socketsRef.current.set(terminalId, ws);

          ws.onmessage = (evt) => {
            let msg;
            try {
              msg = JSON.parse(evt.data);
            } catch {
              return;
            }

            if (msg.type === "stdout" || msg.type === "stderr") {
              const rawOutput = (msg.chunk || "").replace(/\r/g, "");

              // Cross-chunk 67 detection: prepend buffered trailing chars
              // from the previous chunk for pattern matching only.
              const bufferMap = pendingBrainrotBufferRef.current;
              const prevTail = bufferMap.get(terminalId) || "";
              const combinedForDetection = prevTail + rawOutput;

              // If the combined text matches 67 pattern but neither piece
              // does individually, feed the brainrot trigger through addLines.
              if (
                prevTail &&
                hasBrainrotToken(combinedForDetection) &&
                !hasBrainrotToken(prevTail) &&
                !hasBrainrotToken(rawOutput)
              ) {
                // Inject a synthetic marker line so addLines triggers the audio.
                // The marker carries no visible length, it only fires the sound.
                addLines(terminalId, [
                  { text: "6 7", type: "__brainrot_bridge" },
                ], true);
              }

              // Save trailing chars (up to 10) for next chunk comparison.
              bufferMap.set(terminalId, rawOutput.slice(-10));

              const chunks = rawOutput
                .split("\n")
                .filter((line) => line.length > 0);
              if (chunks.length === 0) {
                return;
              }

              const visible = chunks.slice(0, MAX_LINES_PER_EVENT);
              addLines(
                terminalId,
                visible.map((line) => ({
                  text: line,
                  type: msg.type === "stderr" ? "error" : "log",
                })),
              );

              if (chunks.length > visible.length) {
                addLines(terminalId, [
                  {
                    text: `...[${chunks.length - visible.length} lines omitted from one output burst]`,
                    type: "muted",
                  },
                ]);
              }
              return;
            }

            if (msg.type === "scan-report") {
              addLines(terminalId, [
                {
                  text: `scan: high=${msg.summary?.high || 0}, medium=${msg.summary?.medium || 0}, low=${msg.summary?.low || 0}`,
                  type: "muted",
                },
              ]);
              return;
            }

            if (msg.type === "system" && msg.message) {
              const type =
                msg.stage === "failed"
                  ? "error"
                  : msg.stage === "blocked"
                    ? "warn"
                    : "system";
              addLines(terminalId, [{ text: msg.message, type }]);
            }

            if (msg.type === "run-ended") {
              addLines(terminalId, [
                {
                  text: `Process exited with code ${msg.exitCode ?? 1}`,
                  type: msg.exitCode === 0 ? "system" : "error",
                },
              ]);

              updateTerminal(
                terminalId,
                (current) => ({
                  ...current,
                  isRunning: false,
                  activeExecutionId: null,
                  lockOwnerId: current.retainLockAfterRun
                    ? current.lockOwnerId
                    : null,
                  lockOwnerName: current.retainLockAfterRun
                    ? current.lockOwnerName
                    : null,
                }),
                true,
              );
              cleanupSocket(terminalId);
            }

            if (
              msg.type === "system" &&
              (msg.stage === "failed" || msg.stage === "blocked")
            ) {
              updateTerminal(
                terminalId,
                (current) => ({
                  ...current,
                  isRunning: false,
                  activeExecutionId: null,
                  lockOwnerId: current.retainLockAfterRun
                    ? current.lockOwnerId
                    : null,
                  lockOwnerName: current.retainLockAfterRun
                    ? current.lockOwnerName
                    : null,
                }),
                true,
              );
              cleanupSocket(terminalId);
            }
          };

          ws.onerror = () => {
            addLines(terminalId, [
              { text: "Execution stream connection failed", type: "error" },
            ]);
            updateTerminal(
              terminalId,
              (current) => ({
                ...current,
                isRunning: false,
                activeExecutionId: null,
                lockOwnerId: current.retainLockAfterRun
                  ? current.lockOwnerId
                  : null,
                lockOwnerName: current.retainLockAfterRun
                  ? current.lockOwnerName
                  : null,
              }),
              true,
            );
            cleanupSocket(terminalId);
          };

          ws.onclose = () => {
            updateTerminal(
              terminalId,
              (current) => ({
                ...current,
                isRunning: false,
                activeExecutionId: null,
                lockOwnerId: current.retainLockAfterRun
                  ? current.lockOwnerId
                  : current.isRunning
                    ? null
                    : current.lockOwnerId,
                lockOwnerName: current.retainLockAfterRun
                  ? current.lockOwnerName
                  : current.isRunning
                    ? null
                    : current.lockOwnerName,
              }),
              true,
            );
          };
        })
        .catch((error) => {
          addLines(terminalId, [
            { text: `Failed to run: ${error.message}`, type: "error" },
          ]);
          updateTerminal(
            terminalId,
            (current) => ({
              ...current,
              isRunning: false,
              activeExecutionId: null,
              lockOwnerId: current.retainLockAfterRun
                ? current.lockOwnerId
                : null,
              lockOwnerName: current.retainLockAfterRun
                ? current.lockOwnerName
                : null,
            }),
            true,
          );
          cleanupSocket(terminalId);
        });
    },
    [
      acquireLock,
      addLines,
      cleanupSocket,
      code,
      displayName,
      isRunnable,
      language,
      updateTerminal,
      user?.id,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      runSnippetInNewTerminal: (snippet, meta = {}) => {
        const snippetText = typeof snippet === "string" ? snippet : "";
        if (!snippetText.trim()) {
          return false;
        }

        const sourceLabel = meta?.sourceLabel || "selection";
        const snippetLines = snippetText.split("\n").length;
        const now = Date.now();
        const lockToken = user?.id
          ? `${user.id}-${now}-${Math.floor(Math.random() * 100000)}`
          : null;
        const nextTerminal = {
          ...createTerminal(terminals.length + 1, displayName),
          createdById: user?.id || null,
          isSnippetTerminal: true,
          retainLockAfterRun: true,
          lockOwnerId: user?.id || null,
          lockOwnerName: displayName,
          lockToken,
          lastHeartbeatAt: now,
          lastActivityAt: now,
        };

        const nextTerminals = [...terminals, nextTerminal];
        applyAndMaybeBroadcast(nextTerminals, nextTerminal.id, true);

        setTimeout(() => {
          addLines(nextTerminal.id, [
            {
              text: `Running snippet from ${sourceLabel} (${snippetLines} line${snippetLines === 1 ? "" : "s"})`,
              type: "muted",
            },
          ]);
          executeCode(nextTerminal.id, snippetText, "snippet");
        }, 0);

        return true;
      },
    }),
    [
      addLines,
      applyAndMaybeBroadcast,
      displayName,
      executeCode,
      terminals,
      user?.id,
    ],
  );

  const handleCommand = useCallback(
    (terminalId, rawInput) => {
      const trimmed = rawInput.trim();
      if (!trimmed) return;

      const lockOutcome = acquireLock(terminalId);
      if (lockOutcome !== "acquired") {
        addLines(terminalId, [
          {
            text:
              lockOutcome === "requested"
                ? "Lock requested. Try again once granted."
                : "Terminal is locked by another collaborator",
            type: "warn",
          },
        ]);
        return;
      }

      addLines(terminalId, [{ text: `$ ${trimmed}`, type: "input" }]);

      updateTerminal(
        terminalId,
        (terminal) => ({
          ...terminal,
          commandHistory: [...terminal.commandHistory, trimmed],
        }),
        true,
      );

      setHistoryIndex(-1);

      const parts = trimmed.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (cmd === "clear") {
        updateTerminal(
          terminalId,
          (terminal) => ({
            ...terminal,
            lines: [],
          }),
          true,
        );
        return;
      }

      if (cmd === "run") {
        executeCode(terminalId);
        return;
      }

      if (cmd === "stop") {
        stopExecution(terminalId);
        return;
      }

      if (cmd === "lock") {
        addLines(terminalId, [{ text: "Lock is active", type: "system" }]);
        return;
      }

      if (cmd === "unlock") {
        releaseLock(terminalId, true);
        addLines(terminalId, [{ text: "Lock released", type: "system" }]);
        return;
      }

      if (cmd === "echo") {
        addLines(terminalId, [{ text: args.join(" "), type: "log" }]);
        return;
      }

      if (BUILTIN_COMMANDS[cmd]) {
        addLines(terminalId, BUILTIN_COMMANDS[cmd](args));
        return;
      }

      addLines(terminalId, [
        {
          text: `${cmd}: command not supported yet`,
          type: "warn",
        },
        {
          text: "Supported commands: help, clear, echo, run, stop, lock, unlock",
          type: "muted",
        },
      ]);
    },
    [
      acquireLock,
      addLines,
      executeCode,
      releaseLock,
      stopExecution,
      updateTerminal,
    ],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!activeTerminal) return;

      if (e.key === "Enter") {
        e.preventDefault();

        if (activeTerminal.isRunning) {
          sendRuntimeInput(activeTerminal.id, inputValue);
        } else {
          handleCommand(activeTerminal.id, inputValue);
        }

        setInputValue("");
        return;
      }

      if (e.key === "ArrowUp") {
        if (activeTerminal.isRunning) return;
        e.preventDefault();

        const history = activeTerminal.commandHistory || [];
        if (history.length === 0) return;

        const newIndex =
          historyIndex === -1
            ? history.length - 1
            : Math.max(0, historyIndex - 1);

        setHistoryIndex(newIndex);
        setInputValue(history[newIndex]);
        return;
      }

      if (e.key === "ArrowDown") {
        if (activeTerminal.isRunning) return;
        e.preventDefault();

        const history = activeTerminal.commandHistory || [];
        if (historyIndex === -1) return;

        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInputValue("");
        } else {
          setHistoryIndex(newIndex);
          setInputValue(history[newIndex]);
        }
        return;
      }

      if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        if (!canControlActiveTerminal) {
          setShowJumpscare(true);
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.volume = 1;
            audioRef.current.play().catch(console.error);
          }
          setTimeout(() => {
            setShowJumpscare(false);
            if (audioRef.current) audioRef.current.pause();
          }, 2000);
          toast?.error(
            "Cannot clear a terminal locked by another collaborator",
          );
          return;
        }
        updateTerminal(
          activeTerminal.id,
          (terminal) => ({
            ...terminal,
            lines: [],
          }),
          true,
        );
        return;
      }

      if (e.key === "c" && e.ctrlKey) {
        e.preventDefault();
        if (activeTerminal.isRunning) {
          addLines(activeTerminal.id, [{ text: "^C", type: "error" }]);
          stopExecution(activeTerminal.id);
        } else {
          setInputValue("");
        }
      }
    },
    [
      activeTerminal,
      addLines,
      canControlActiveTerminal,
      handleCommand,
      historyIndex,
      inputValue,
      sendRuntimeInput,
      stopExecution,
      updateTerminal,
    ],
  );

  const handleResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      isDraggingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = panelHeight;

      const handleMouseMove = (event) => {
        if (!isDraggingRef.current) return;
        const delta = startYRef.current - event.clientY;
        setPanelHeight(
          Math.max(140, Math.min(600, startHeightRef.current + delta)),
        );
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [panelHeight],
  );

  const createNewTerminal = useCallback(() => {
    const next = [
      ...terminals,
      {
        ...createTerminal(terminals.length + 1, displayName),
        createdById: user?.id || null,
      },
    ];
    const nextActiveId = next[next.length - 1].id;
    applyAndMaybeBroadcast(next, nextActiveId, true);
    setInputValue("");
    setHistoryIndex(-1);
  }, [applyAndMaybeBroadcast, displayName, terminals, user?.id]);

  const closeTerminal = useCallback(
    (terminalId) => {
      const terminal = terminals.find((t) => t.id === terminalId);
      if (!terminal) return;

      if (terminal.lockOwnerId && terminal.lockOwnerId !== user?.id) {
        setShowJumpscare(true);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.volume = 1;
          audioRef.current.play().catch(console.error);
        }
        setTimeout(() => {
          setShowJumpscare(false);
          if (audioRef.current) audioRef.current.pause();
        }, 2000);
        toast?.error("Cannot close a terminal locked by another collaborator");
        return;
      }

      if (terminal.isRunning) {
        stopExecution(terminalId);
      }

      cleanupSocket(terminalId);

      const filtered = terminals.filter((t) => t.id !== terminalId);
      if (filtered.length === 0) {
        applyAndMaybeBroadcast([], null, true);
        onToggle?.();
        return;
      }

      const nextActiveId =
        activeTerminalId === terminalId
          ? filtered[filtered.length - 1].id
          : activeTerminalId;

      applyAndMaybeBroadcast(filtered, nextActiveId, true);
      setInputValue("");
      setHistoryIndex(-1);
    },
    [
      activeTerminalId,
      applyAndMaybeBroadcast,
      cleanupSocket,
      onToggle,
      stopExecution,
      terminals,
      user?.id,
    ],
  );

  const handleClear = useCallback(() => {
    if (!activeTerminal) return;

    if (!canControlActiveTerminal) {
      setShowJumpscare(true);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 1;
        audioRef.current.play().catch(console.error);
      }
      setTimeout(() => {
        setShowJumpscare(false);
        if (audioRef.current) audioRef.current.pause();
      }, 2000);
      toast?.error("Cannot clear a terminal locked by another collaborator");
      return;
    }

    updateTerminal(
      activeTerminal.id,
      (terminal) => ({
        ...terminal,
        lines: [],
      }),
      true,
    );
  }, [activeTerminal, canControlActiveTerminal, updateTerminal]);

  const handleToggleLock = useCallback(() => {
    if (!activeTerminal) return;

    if (activeTerminal.lockOwnerId === user?.id) {
      releaseLock(activeTerminal.id, true);
      addLines(activeTerminal.id, [{ text: "Lock released", type: "system" }]);
      return;
    }

    const outcome = acquireLock(activeTerminal.id);
    if (outcome === "acquired") {
      addLines(activeTerminal.id, [{ text: "Lock acquired", type: "system" }]);
      return;
    }

    if (outcome === "requested") {
      addLines(activeTerminal.id, [
        { text: "Lock requested. Try again once granted.", type: "warn" },
      ]);
      return;
    }

    addLines(activeTerminal.id, [
      { text: "Terminal is locked by another collaborator", type: "warn" },
    ]);
  }, [acquireLock, activeTerminal, addLines, releaseLock, user?.id]);

  const handleOutputClick = useCallback(() => {
    if (activeTerminal) {
      acquireLock(activeTerminal.id);
    }
    inputRef.current?.focus();
  }, [acquireLock, activeTerminal]);

  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTerminal?.lines]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, activeTerminalId]);

  useEffect(() => {
    if (!terminalStorageKey) return;

    try {
      const raw = localStorage.getItem(terminalStorageKey);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.terminals)) return;

      const normalizedTerminals = saved.terminals.map(normalizeTerminal);
      const savedActiveId =
        saved.activeTerminalId &&
          normalizedTerminals.some(
            (terminal) => terminal.id === saved.activeTerminalId,
          )
          ? saved.activeTerminalId
          : normalizedTerminals[0]?.id || null;

      suppressNextBroadcastRef.current = true;
      setTerminals(normalizedTerminals);
      setActiveTerminalId(savedActiveId);
    } catch {
      localStorage.removeItem(terminalStorageKey);
    }
  }, [terminalStorageKey]);

  useEffect(() => {
    if (!terminalStorageKey) return;

    try {
      localStorage.setItem(
        terminalStorageKey,
        JSON.stringify({
          terminals,
          activeTerminalId,
          updatedAt: Date.now(),
        }),
      );
    } catch {
      // Ignore storage quota and serialization failures.
    }
  }, [activeTerminalId, terminalStorageKey, terminals]);

  useEffect(() => {
    setOnTerminalSnapshot((snapshot) => {
      if (!snapshot || !Array.isArray(snapshot.terminals)) return;

      const normalizedTerminals = snapshot.terminals.map(normalizeTerminal);

      suppressNextBroadcastRef.current = true;
      setTerminals(normalizedTerminals);
      setActiveTerminalId((currentActiveId) => {
        if (normalizedTerminals.length === 0) {
          return null;
        }

        if (
          currentActiveId &&
          normalizedTerminals.some(
            (terminal) => terminal.id === currentActiveId,
          )
        ) {
          return currentActiveId;
        }

        if (
          snapshot.activeTerminalId &&
          normalizedTerminals.some(
            (terminal) => terminal.id === snapshot.activeTerminalId,
          )
        ) {
          return snapshot.activeTerminalId;
        }

        return normalizedTerminals[0].id;
      });
    });

    return () => {
      setOnTerminalSnapshot(null);
    };
  }, [setOnTerminalSnapshot]);

  useEffect(() => {
    setOnTerminalLockRequest((payload) => {
      if (
        !isAuthoritativeHostRef.current ||
        !payload?.terminalId ||
        !payload?.userId
      ) {
        return;
      }

      const target = terminalsRef.current.find(
        (t) => t.id === payload.terminalId,
      );
      if (!target) return;

      const stale = isLockStale(target);
      const canGrant =
        !target.lockOwnerId || stale || target.lockOwnerId === payload.userId;

      if (!canGrant) {
        broadcastTerminalLockGrant({
          userId: userIdRef.current,
          toUserId: payload.userId,
          toUserName: payload.userName,
          terminalId: payload.terminalId,
          approved: false,
          deniedBy: target.lockOwnerName || target.lockOwnerId,
          requestedAt: payload.requestedAt,
        });
        return;
      }

      const lockToken =
        payload.requestToken || `${payload.userId}-${Date.now()}`;

      updateTerminal(
        payload.terminalId,
        (terminal) => ({
          ...terminal,
          lockOwnerId: payload.userId,
          lockOwnerName:
            payload.userName || terminal.lockOwnerName || "Collaborator",
          lockToken,
          lastHeartbeatAt: Date.now(),
          lastActivityAt: Date.now(),
        }),
        true,
      );

      broadcastTerminalLockGrant({
        userId: userIdRef.current,
        toUserId: payload.userId,
        toUserName: payload.userName,
        terminalId: payload.terminalId,
        approved: true,
        lockToken,
        grantedAt: Date.now(),
      });
    });

    return () => {
      setOnTerminalLockRequest(null);
    };
  }, [
    broadcastTerminalLockGrant,
    isLockStale,
    setOnTerminalLockRequest,
    updateTerminal,
  ]);

  useEffect(() => {
    setOnTerminalLockGrant((payload) => {
      if (!payload || payload.toUserId !== user?.id) {
        return;
      }

      if (!payload.approved) {
        // addLines(payload.terminalId, [
        //   {
        //     text: `Lock denied${payload.deniedBy ? `: held by ${payload.deniedBy}` : ""}`,
        //     type: "warn",
        //   },
        // ]);
        return;
      }

      updateTerminal(
        payload.terminalId,
        (terminal) => ({
          ...terminal,
          lockOwnerId: user.id,
          lockOwnerName: displayName,
          lockToken: payload.lockToken || terminal.lockToken,
          lastHeartbeatAt: Date.now(),
          lastActivityAt: Date.now(),
        }),
        true,
      );
    });

    return () => {
      setOnTerminalLockGrant(null);
    };
  }, [addLines, displayName, setOnTerminalLockGrant, updateTerminal, user?.id]);

  useEffect(() => {
    return () => {
      Array.from(socketsRef.current.keys()).forEach((terminalId) => {
        cleanupSocket(terminalId);
      });
    };
  }, [cleanupSocket]);

  useEffect(() => {
    if (!isAuthoritativeHost) return;

    const timer = setInterval(() => {
      setTerminals((prev) => {
        let changed = false;
        const now = Date.now();

        const next = prev.map((terminal) => {
          if (!terminal.lockOwnerId || !terminal.lastHeartbeatAt) {
            return terminal;
          }

          if (now - terminal.lastHeartbeatAt <= LOCK_STALE_MS) {
            return terminal;
          }

          changed = true;
          return {
            ...terminal,
            lockOwnerId: null,
            lockOwnerName: null,
            lockToken: null,
            lastHeartbeatAt: null,
            lastActivityAt: now,
            lines: [
              ...terminal.lines,
              {
                id: `${now}-${Math.random()}`,
                text: "Lock auto-released (inactive owner timeout)",
                type: "muted",
                time: formatTimestamp(),
              },
            ].slice(-MAX_TERMINAL_LINES),
          };
        });

        if (!changed) {
          return prev;
        }

        if (user?.id) {
          broadcastTerminalSnapshot(user.id, {
            terminals: next,
            activeTerminalId,
            updatedAt: Date.now(),
          });
        }

        return next;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [
    activeTerminalId,
    broadcastTerminalSnapshot,
    isAuthoritativeHost,
    user?.id,
  ]);

  useEffect(() => {
    if (!user?.id) return;

    const timer = setInterval(() => {
      setTerminals((prev) => {
        const now = Date.now();
        let changed = false;

        const next = prev.map((terminal) => {
          if (terminal.lockOwnerId !== user.id) {
            return terminal;
          }

          changed = true;
          return {
            ...terminal,
            lastHeartbeatAt: now,
          };
        });

        if (!changed) {
          return prev;
        }

        broadcastTerminalSnapshot(user.id, {
          terminals: next,
          activeTerminalId,
          updatedAt: Date.now(),
        });

        return next;
      });
    }, LOCK_HEARTBEAT_MS);

    return () => clearInterval(timer);
  }, [activeTerminalId, broadcastTerminalSnapshot, user?.id]);

  useEffect(() => {
    if (!user?.id || terminals.length === 0) return;

    if (suppressNextBroadcastRef.current) {
      suppressNextBroadcastRef.current = false;
      return;
    }

    broadcastTerminalSnapshot(user.id, {
      terminals,
      activeTerminalId,
      updatedAt: Date.now(),
    });
  }, [
    activeTerminalId,
    broadcastTerminalSnapshot,
    collaborators.length,
    terminals,
    user?.id,
  ]);

  const getLineColor = (type) => {
    switch (type) {
      case "error":
        return "text-red-400";
      case "warn":
        return "text-amber-400";
      case "system":
        return "text-accent-400";
      case "muted":
        return "text-neutral-500";
      case "input":
        return "text-neutral-100 font-medium";
      default:
        return "text-neutral-300";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: panelHeight, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
          className="flex flex-col border-t border-neutral-800 bg-neutral-950 flex-shrink-0 overflow-hidden"
          style={{ minHeight: 0 }}
        >
          <div
            className="h-1 bg-neutral-950 hover:bg-accent-500/30 cursor-row-resize transition-colors flex-shrink-0"
            onMouseDown={handleResizeStart}
          />

          <div className="h-9 flex items-center justify-between px-3 bg-[#121215] border-b border-neutral-800 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                <TerminalIcon className="w-3.5 h-3.5 text-neutral-400" />
                <span className="font-semibold text-neutral-300 font-display">
                  Terminal
                </span>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {terminals.map((terminal) => {
                  const isActive = terminal.id === activeTerminalId;
                  const lockedByOther = !!terminal.lockOwnerId;
                  const isSnippetTerminal = !!terminal.isSnippetTerminal;
                  const lockOwnerDisplayName = terminal.lockOwnerId
                    ? collaboratorNameById.get(terminal.lockOwnerId) ||
                    terminal.lockOwnerName ||
                    terminal.lockOwnerId
                    : null;

                  return (
                    <button
                      key={terminal.id}
                      onClick={() => {
                        setActiveTerminalId(terminal.id);
                      }}
                      className={`px-2 py-1 rounded text-xs border transition-colors whitespace-nowrap ${isActive
                          ? "bg-neutral-800 border-neutral-600 text-neutral-100"
                          : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      title={terminal.name}
                    >
                      <span>{terminal.name}</span>
                      {isSnippetTerminal && (
                        <span className="ml-1 inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold bg-primary-500/20 text-primary-400 border border-primary-500/30 align-middle">
                          Snippet
                        </span>
                      )}
                      {terminal.isRunning && (
                        <Loader2 className="w-3 h-3 inline ml-1 animate-spin text-accent-400" />
                      )}
                      {lockedByOther && (
                        <span className="ml-1 inline-flex items-center gap-1 align-middle text-amber-400">
                          <Lock className="w-3 h-3" />
                          <span className="text-[10px] max-w-[90px] truncate">
                            {lockOwnerDisplayName}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  onClick={createNewTerminal}
                  className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                  title="Create terminal"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {activeTerminal?.isSnippetTerminal && (
                <div className="hidden md:flex items-center gap-1.5 text-xs text-primary-400 px-2 py-1 rounded bg-primary-500/10 border border-primary-500/20 mr-1">
                  <span>Snippet Run</span>
                </div>
              )}

              {activeTerminal?.lockOwnerId && (
                <div className="hidden md:flex items-center gap-1.5 text-xs text-amber-400 px-2 py-1 rounded bg-amber-500/10 mr-1">
                  <Lock className="w-3 h-3" />
                  <span>
                    {(activeTerminal.lockOwnerId === user?.id
                      ? "You"
                      : collaboratorNameById.get(activeTerminal.lockOwnerId) ||
                      activeTerminal.lockOwnerName ||
                      activeTerminal.lockOwnerId) + " locked"}
                  </span>
                </div>
              )}

              {isRunnable && (
                <>
                  <button
                    onClick={() =>
                      activeTerminal && executeCode(activeTerminal.id)
                    }
                    disabled={
                      !activeTerminal ||
                      activeTerminal.isRunning ||
                      !canControlActiveTerminal
                    }
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={`Run ${language} code`}
                  >
                    <Play className="w-3 h-3" />
                    Run
                  </button>
                  <button
                    onClick={() =>
                      activeTerminal && stopExecution(activeTerminal.id)
                    }
                    disabled={
                      !activeTerminal ||
                      !activeTerminal.isRunning ||
                      !canControlActiveTerminal
                    }
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Stop execution"
                  >
                    <Square className="w-3 h-3" />
                    Stop
                  </button>
                </>
              )}

              <button
                onClick={handleToggleLock}
                disabled={!activeTerminal || isLockedByOther}
                className="p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title={
                  activeTerminal?.lockOwnerId === user?.id
                    ? "Unlock terminal"
                    : "Lock terminal"
                }
              >
                {activeTerminal?.lockOwnerId === user?.id ? (
                  <Unlock className="w-3 h-3" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
              </button>

              <button
                onClick={handleClear}
                disabled={!activeTerminal}
                className="p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Clear (Ctrl+L)"
              >
                <Trash2 className="w-3 h-3" />
              </button>

              <button
                onClick={() =>
                  activeTerminal && closeTerminal(activeTerminal.id)
                }
                className="p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                title="Close active terminal"
              >
                <Square className="w-3 h-3" />
              </button>

              <button
                onClick={onToggle}
                className="p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                title="Close panel"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[13px] leading-6 select-text cursor-text"
            onClick={handleOutputClick}
          >
            {!activeTerminal ? (
              <div className="h-full min-h-[140px] flex items-center justify-center">
                <div className="text-center">
                  <p className="text-neutral-400 text-sm mb-3">
                    No terminals open
                  </p>
                  <button
                    onClick={createNewTerminal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create terminal
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-2 px-2 py-1 rounded border border-neutral-800 bg-neutral-900/50 text-[11px] text-neutral-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>by {activeTerminal.createdByName || "Unknown"}</span>
                  <span className="text-neutral-700">•</span>
                  <span className="flex items-center gap-1">
                    <Clock3 className="w-3 h-3" />
                    active {formatRelativeTime(activeTerminal.lastActivityAt)}
                  </span>
                  {activeTerminal.lockOwnerId && (
                    <>
                      <span className="text-neutral-700">•</span>
                      <span>
                        lock{" "}
                        {activeTerminal.lockOwnerId === user?.id
                          ? "you"
                          : collaboratorNameById.get(
                            activeTerminal.lockOwnerId,
                          ) ||
                          activeTerminal.lockOwnerName ||
                          activeTerminal.lockOwnerId}
                      </span>
                    </>
                  )}
                </div>

                {activeTerminal.lines.map((line) => (
                  <div key={line.id} className="flex gap-2 min-h-[1.5rem]">
                    {line.time && (
                      <span className="text-neutral-700 select-none flex-shrink-0 text-[11px] mt-[2px]">
                        {line.time}
                      </span>
                    )}
                    {!line.time && <span className="w-[52px] flex-shrink-0" />}
                    <span
                      className={`${getLineColor(line.type)} whitespace-pre-wrap break-all`}
                    >
                      {line.hasBrainrot
                        ? renderHighlighted67(line.text)
                        : line.text}
                    </span>
                  </div>
                ))}

                <div className="flex gap-2 items-center min-h-[1.5rem]">
                  <span className="w-[52px] flex-shrink-0" />
                  <span
                    className={`select-none ${isLockedByOther ? "text-amber-400" : "text-accent-400"
                      }`}
                  >
                    $
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={`flex-1 bg-transparent border-none outline-none text-[13px] font-mono placeholder-neutral-600 ${isLockedByOther
                        ? "text-neutral-500 caret-transparent cursor-not-allowed"
                        : "text-neutral-100 caret-accent-400"
                      }`}
                    placeholder={
                      isLockedByOther
                        ? `locked by ${collaboratorNameById.get(activeTerminal.lockOwnerId) || activeTerminal.lockOwnerName || activeTerminal.lockOwnerId}`
                        : activeTerminal.isRunning
                          ? "type stdin and press Enter..."
                          : "type a command..."
                    }
                    disabled={isLockedByOther}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                  />
                </div>

                <div ref={outputEndRef} />
              </>
            )}
          </div>

          <div
            className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center pointer-events-none transition-opacity duration-75 ${showJumpscare ? "opacity-100" : "opacity-0"
              }`}
          >
            {jumpscareImageUrl && (
              <img
                src={jumpscareImageUrl}
                alt="jumpscare"
                /*
                 * EDIT PHOTO PLACEMENT HERE:
                 * - "w-full h-full object-cover": Fills and crops to fit the entire screen.
                 * - "w-[70vw] h-[70vh] object-contain": Makes it a bit smaller and keeps original proportions.
                 * - "fixed top-10 right-10 w-64 h-64 shadow-xl": Places it in the top right corner.
                 */
                className="w-[100vw] h-[120vh] object-contain"
              />
            )}
          </div>
          <audio
            ref={audioRef}
            src={jumpscareAudioUrl}
            preload="auto"
            style={{ display: "none" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default TerminalPanel;
