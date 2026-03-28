import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Square,
  Trash2,
  ChevronDown,
  Terminal as TerminalIcon,
  Loader2,
} from "lucide-react";

const RUNNABLE_LANGUAGES = ["javascript", "python"];
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8787";

function formatTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Local helper commands for terminal UX.
const BUILTIN_COMMANDS = {
  help: () => [
    { text: "Available commands:", type: "system" },
    { text: "  help          Show this help message", type: "log" },
    { text: "  clear         Clear the terminal", type: "log" },
    { text: "  echo <text>   Print text to output", type: "log" },
    { text: "  whoami        Show current user", type: "log" },
    { text: "  date          Show current date/time", type: "log" },
    { text: "  run           Execute current editor code", type: "log" },
    { text: "  stop          Stop current execution", type: "log" },
    { text: "", type: "log" },
    {
      text: "  Other commands will be executed in Docker when the backend is connected.",
      type: "muted",
    },
  ],
  whoami: () => [{ text: "developer@itecify", type: "log" }],
  date: () => [{ text: new Date().toString(), type: "log" }],
  pwd: () => [{ text: "/workspace/project", type: "log" }],
  ls: () => [{ text: "main.js  main.py  README.md", type: "log" }],
};

export default function TerminalPanel({ language, code, isOpen, onToggle }) {
  const [lines, setLines] = useState([
    {
      id: "welcome",
      text: "iTECify Terminal v1.0 — Type 'help' for available commands",
      type: "system",
      time: formatTimestamp(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [panelHeight, setPanelHeight] = useState(240);
  const [activeExecutionId, setActiveExecutionId] = useState(null);

  const inputRef = useRef(null);
  const outputEndRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const wsRef = useRef(null);

  const isRunnable = RUNNABLE_LANGUAGES.includes(language);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines]);

  // Focus input when terminal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const addLines = useCallback((newLines) => {
    const time = formatTimestamp();
    setLines((prev) => [
      ...prev,
      ...newLines.map((line, i) => ({
        id: Date.now() + i + Math.random(),
        text: line.text,
        type: line.type || "log",
        time: i === 0 ? time : "",
      })),
    ]);
  }, []);

  const cleanupSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const normalizeLanguage = useCallback((value) => {
    return value;
  }, []);

  const stopExecution = useCallback(async () => {
    if (!activeExecutionId) {
      addLines([{ text: "No active execution to stop", type: "muted" }]);
      return;
    }

    try {
      await fetch(`${BACKEND_URL}/v1/executions/${activeExecutionId}/stop`, {
        method: "POST",
      });
      addLines([{ text: "▸ Stop requested", type: "system" }]);
    } catch (error) {
      addLines([
        {
          text: `Failed to stop execution: ${error.message}`,
          type: "error",
        },
      ]);
    }
  }, [activeExecutionId, addLines]);

  const sendRuntimeInput = useCallback(
    async (input) => {
      if (!activeExecutionId) {
        return;
      }

      try {
        const response = await fetch(
          `${BACKEND_URL}/v1/executions/${activeExecutionId}/input`,
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

        addLines([{ text: `> ${input}`, type: "input" }]);
      } catch (error) {
        addLines([{ text: `Failed to send input: ${error.message}`, type: "error" }]);
      }
    },
    [activeExecutionId, addLines],
  );

  const executeCode = useCallback(() => {
    if (!isRunnable) {
      addLines([
        {
          text: `⚠ ${language} execution is not supported yet. Use JavaScript or Python.`,
          type: "warn",
        },
      ]);
      return;
    }

    if (isRunning) {
      addLines([{ text: "Execution already running", type: "warn" }]);
      return;
    }

    setIsRunning(true);
    addLines([{ text: `▸ Running ${language}...`, type: "system" }]);

    cleanupSocket();

    fetch(`${BACKEND_URL}/v1/executions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: normalizeLanguage(language),
        code,
      }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error || "Failed to start execution");
        }

        const executionId = body.executionId;
        setActiveExecutionId(executionId);

        const wsBase = BACKEND_URL.replace(/^http/i, "ws");
        const ws = new WebSocket(`${wsBase}/v1/executions/${executionId}/stream`);
        wsRef.current = ws;

        ws.onmessage = (evt) => {
          let msg;
          try {
            msg = JSON.parse(evt.data);
          } catch {
            return;
          }

          if (msg.type === "stdout" || msg.type === "stderr") {
            const output = (msg.chunk || "").replace(/\r/g, "");
            const chunks = output.split("\n").filter((line) => line.length > 0);
            if (chunks.length === 0) {
              return;
            }
            addLines(
              chunks.map((line) => ({
                text: line,
                type: msg.type === "stderr" ? "error" : "log",
              })),
            );
            return;
          }

          if (msg.type === "scan-report") {
            addLines([
              {
                text: `scan: high=${msg.summary?.high || 0}, medium=${msg.summary?.medium || 0}, low=${msg.summary?.low || 0}`,
                type: "muted",
              },
            ]);
            return;
          }

          if (msg.type === "system" && msg.message) {
            const type = msg.stage === "failed" ? "error" : msg.stage === "blocked" ? "warn" : "system";
            addLines([{ text: msg.message, type }]);
          }

          if (msg.type === "run-ended") {
            addLines([
              {
                text: `▸ Process exited with code ${msg.exitCode ?? 1}`,
                type: msg.exitCode === 0 ? "system" : "error",
              },
            ]);
            setIsRunning(false);
            setActiveExecutionId(null);
            cleanupSocket();
          }

          if (msg.type === "system" && (msg.stage === "failed" || msg.stage === "blocked")) {
            setIsRunning(false);
            setActiveExecutionId(null);
            cleanupSocket();
          }
        };

        ws.onerror = () => {
          addLines([{ text: "Execution stream connection failed", type: "error" }]);
          setIsRunning(false);
          setActiveExecutionId(null);
          cleanupSocket();
        };

        ws.onclose = () => {
          if (isRunning) {
            setIsRunning(false);
            setActiveExecutionId(null);
          }
        };
      })
      .catch((error) => {
        addLines([{ text: `Failed to run: ${error.message}`, type: "error" }]);
        setIsRunning(false);
        setActiveExecutionId(null);
      });
  }, [
    addLines,
    cleanupSocket,
    code,
    isRunnable,
    isRunning,
    language,
    normalizeLanguage,
  ]);

  const handleCommand = useCallback(
    (rawInput) => {
      const trimmed = rawInput.trim();
      if (!trimmed) return;

      // Show the command in output
      addLines([{ text: `$ ${trimmed}`, type: "input" }]);

      // Add to history
      setCommandHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);

      const parts = trimmed.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      // Built-in commands
      if (cmd === "clear") {
        setLines([]);
        return;
      }

      if (cmd === "run") {
        executeCode();
        return;
      }

      if (cmd === "stop") {
        stopExecution();
        return;
      }

      if (cmd === "echo") {
        addLines([{ text: args.join(" "), type: "log" }]);
        return;
      }

      if (BUILTIN_COMMANDS[cmd]) {
        addLines(BUILTIN_COMMANDS[cmd](args));
        return;
      }

      // Unknown command — placeholder until Docker backend
      addLines([
        {
          text: `${cmd}: command not supported in single-user terminal yet`,
          type: "warn",
        },
        {
          text: "  Supported commands: help, clear, echo, run, stop",
          type: "muted",
        },
      ]);
    },
    [addLines, executeCode, stopExecution],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (isRunning) {
          sendRuntimeInput(inputValue);
        } else {
          handleCommand(inputValue);
        }
        setInputValue("");
      } else if (e.key === "ArrowUp") {
        if (isRunning) return;
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      } else if (e.key === "ArrowDown") {
        if (isRunning) return;
        e.preventDefault();
        if (historyIndex === -1) return;
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInputValue("");
        } else {
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[newIndex]);
        }
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        setLines([]);
      } else if (e.key === "c" && e.ctrlKey) {
        e.preventDefault();
        if (isRunning) {
          addLines([{ text: "^C", type: "error" }]);
          stopExecution();
        } else {
          setInputValue("");
        }
      }
    },
    [
      inputValue,
      commandHistory,
      historyIndex,
      handleCommand,
      isRunning,
      addLines,
      stopExecution,
      sendRuntimeInput,
    ],
  );

  // Resize
  const handleResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      isDraggingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = panelHeight;

      const handleMouseMove = (e) => {
        if (!isDraggingRef.current) return;
        const delta = startYRef.current - e.clientY;
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

  const handleClear = useCallback(() => setLines([]), []);

  useEffect(() => {
    return () => {
      cleanupSocket();
    };
  }, [cleanupSocket]);

  // Click anywhere in output area → focus input
  const handleOutputClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

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
          {/* Resize handle */}
          <div
            className="h-1 bg-neutral-950 hover:bg-accent-500/30 cursor-row-resize transition-colors flex-shrink-0"
            onMouseDown={handleResizeStart}
          />

          {/* Header bar */}
          <div className="h-9 flex items-center justify-between px-3 bg-[#121215] border-b border-neutral-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <TerminalIcon className="w-3.5 h-3.5 text-neutral-400" />
                <span className="font-semibold text-neutral-300 font-display">
                  Terminal
                </span>
              </div>

              {isRunning && (
                <div className="flex items-center gap-1.5 text-xs text-accent-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Running</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Run code */}
              {isRunnable && (
                <>
                  <button
                    onClick={executeCode}
                    disabled={isRunning}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={`Run ${language} code`}
                  >
                    <Play className="w-3 h-3" />
                    Run
                  </button>
                  <button
                    onClick={stopExecution}
                    disabled={!isRunning}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Stop execution"
                  >
                    <Square className="w-3 h-3" />
                    Stop
                  </button>
                </>
              )}

              {/* Clear */}
              <button
                onClick={handleClear}
                className="p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                title="Clear (Ctrl+L)"
              >
                <Trash2 className="w-3 h-3" />
              </button>

              {/* Close */}
              <button
                onClick={onToggle}
                className="p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                title="Close panel"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Terminal body */}
          <div
            className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[13px] leading-6 select-text cursor-text"
            onClick={handleOutputClick}
          >
            {/* Output lines */}
            {lines.map((line) => (
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
                  {line.text}
                </span>
              </div>
            ))}

            {/* Input line */}
            <div className="flex gap-2 items-center min-h-[1.5rem]">
              <span className="w-[52px] flex-shrink-0" />
              <span className="text-accent-400 select-none">$</span>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none outline-none text-neutral-100 caret-accent-400 text-[13px] font-mono placeholder-neutral-600"
                placeholder={isRunning ? "type stdin and press Enter..." : "type a command..."}
                disabled={false}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
              />
            </div>

            <div ref={outputEndRef} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
