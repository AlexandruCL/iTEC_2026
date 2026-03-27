import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Square,
  Trash2,
  ChevronDown,
  Terminal as TerminalIcon,
  Loader2,
  X,
} from "lucide-react";

const RUNNABLE_LANGUAGES = ["javascript", "python"];

function formatTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Simulated built-in commands (until Docker backend is connected)
const BUILTIN_COMMANDS = {
  help: () => [
    { text: "Available commands:", type: "system" },
    { text: "  help          Show this help message", type: "log" },
    { text: "  clear         Clear the terminal", type: "log" },
    { text: "  echo <text>   Print text to output", type: "log" },
    { text: "  whoami        Show current user", type: "log" },
    { text: "  date          Show current date/time", type: "log" },
    { text: "  run           Execute the current editor code", type: "log" },
    { text: "", type: "log" },
    {
      text: "  Other commands will be executed in Docker when the backend is connected.",
      type: "muted",
    },
  ],
  whoami: () => [{ text: "developer@itecify", type: "log" }],
  date: () => [{ text: new Date().toString(), type: "log" }],
  pwd: () => [{ text: "/workspace/project", type: "log" }],
  ls: () => [
    { text: "main.js  package.json  node_modules/  README.md", type: "log" },
  ],
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

  const inputRef = useRef(null);
  const outputEndRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

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

  const executeCode = useCallback(() => {
    if (!isRunnable) {
      addLines([
        { text: `⚠ ${language} execution is not supported yet`, type: "warn" },
      ]);
      return;
    }

    setIsRunning(true);
    addLines([{ text: `▸ Running ${language}...`, type: "system" }]);

    if (language === "javascript") {
      setTimeout(() => {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const logs = [];

        console.log = (...args) =>
          logs.push({ type: "log", text: args.map(String).join(" ") });
        console.error = (...args) =>
          logs.push({ type: "error", text: args.map(String).join(" ") });
        console.warn = (...args) =>
          logs.push({ type: "warn", text: args.map(String).join(" ") });

        try {
          const fn = new Function(code);
          fn();
          if (logs.length === 0) {
            addLines([{ text: "(no output)", type: "muted" }]);
          } else {
            addLines(logs);
          }
          addLines([{ text: "▸ Process exited with code 0", type: "system" }]);
        } catch (err) {
          if (logs.length > 0) addLines(logs);
          addLines([
            { text: `${err.name}: ${err.message}`, type: "error" },
            { text: "▸ Process exited with code 1", type: "system" },
          ]);
        } finally {
          console.log = originalLog;
          console.error = originalError;
          console.warn = originalWarn;
          setIsRunning(false);
        }
      }, 200);
    } else if (language === "python") {
      setTimeout(() => {
        addLines([
          { text: "⚠ Python requires a backend Docker runtime.", type: "warn" },
          { text: "  Connect in Settings → Runtime to enable.", type: "muted" },
          { text: "▸ Process not started", type: "system" },
        ]);
        setIsRunning(false);
      }, 300);
    }
  }, [code, language, isRunnable, addLines]);

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
          text: `${cmd}: command will be executed when Docker runtime is connected`,
          type: "warn",
        },
        {
          text: `  → queued: ${trimmed}`,
          type: "muted",
        },
      ]);
    },
    [addLines, executeCode],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCommand(inputValue);
        setInputValue("");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      } else if (e.key === "ArrowDown") {
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
          setIsRunning(false);
          addLines([{ text: "^C", type: "error" }]);
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
                <button
                  onClick={executeCode}
                  disabled={isRunning}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={`Run ${language} code`}
                >
                  <Play className="w-3 h-3" />
                  Run
                </button>
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
                placeholder={isRunning ? "waiting..." : "type a command..."}
                disabled={isRunning}
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
