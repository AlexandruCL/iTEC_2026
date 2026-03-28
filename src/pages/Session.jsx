import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Users,
  Sparkles,
  Copy,
  Check,
  Code2,
  FileCode,
  Terminal,
  ChevronRight,
  Braces,
  GitBranch,
  Bell,
  Settings,
  FolderOpen,
  Search,
  Layers,
  X,
  Plus,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useCollaborationStore } from "@/stores/collaborationStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import CodeEditor from "@/components/editor/CodeEditor";
import FileTree from "@/components/editor/FileTree";
import SearchPanel from "@/components/editor/SearchPanel";
import TerminalPanel from "@/components/editor/TerminalPanel";
import AiChat from "@/components/ai/AiChat";
import Button from "@/components/ui/Button";
import toast, { Toaster } from "react-hot-toast";

const LANGUAGE_ICONS = {
  javascript: { icon: Braces, color: "#f7df1e", label: "JS" },
  python: { icon: FileCode, color: "#3776ab", label: "PY" },
  default: { icon: FileCode, color: "#94a3b8", label: "FILE" },
};

function getLangMeta(language) {
  return LANGUAGE_ICONS[language] || LANGUAGE_ICONS.default;
}

function SidebarIcon({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 ${
        active
          ? "text-accent-400 bg-accent-500/10"
          : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
      }`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

export default function Session() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentSession, joinSession, loading } = useSessionStore();
  const { collaborators, joinCollaboration, leaveCollaboration } =
    useCollaborationStore();

  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState("files");
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [editorCode, setEditorCode] = useState("");

  const [fileSystem, setFileSystem] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [navigationTarget, setNavigationTarget] = useState(null);

  const editorRef = useRef(null);
  const terminalRef = useRef(null);
  const saveTimerRef = useRef(null);

  // AI Agent: insert accepted code at the user's cursor position
  const handleApplyAiCode = (code) => {
    if (editorRef.current?.insertTextAtCursor) {
      editorRef.current.insertTextAtCursor(code);
      toast.success("AI code inserted at cursor");
    } else {
      toast.error("No active editor — open a file first");
    }
  };

  const handleRunSelectionInNewTerminal = (selection) => {
    const snippet = selection?.text;
    if (!snippet || !snippet.trim()) {
      toast.error("Select a code snippet first");
      return;
    }

    setIsTerminalOpen(true);

    requestAnimationFrame(() => {
      const ok = terminalRef.current?.runSnippetInNewTerminal?.(snippet, {
        sourceLabel: selection?.path || activeFile || "selection",
      });

      if (!ok) {
        toast.error("Could not open a new terminal for this snippet");
        return;
      }

      const start = selection?.range?.startLineNumber;
      const end = selection?.range?.endLineNumber;
      const linesLabel =
        typeof start === "number" && typeof end === "number"
          ? ` (lines ${start}-${end})`
          : "";
      toast.success(`Snippet opened in a new terminal${linesLabel}`);
    });
  };

  // Reset local state when navigating between different sessions
  useEffect(() => {
    setFileSystem(null);
    setActiveFile(null);
    setOpenFiles([]);
    setNavigationTarget(null);
  }, [sessionId]);

  useEffect(() => {
    if (currentSession?.code && currentSession.id === sessionId && !fileSystem) {
      try {
        const parsed = JSON.parse(currentSession.code);
        if (typeof parsed === "object" && parsed !== null) {
          // Rescue any corrupted files with array-based contents due to the previous event bug
          Object.keys(parsed).forEach(key => {
             if (parsed[key].type === "file" && typeof parsed[key].content !== "string") {
                 let fallback = "";
                 if (Array.isArray(parsed[key].content) && parsed[key].content.length > 0 && parsed[key].content[0].text) {
                     fallback = parsed[key].content[0].text; // Attempt weak rescue
                 }
                 parsed[key].content = fallback;
             }
          });
          setFileSystem(parsed);
          const firstFile = Object.keys(parsed).find(
            (k) => parsed[k].type === "file",
          );
          if (firstFile) {
            setActiveFile(firstFile);
            setOpenFiles([firstFile]);
          }
        } else {
          throw new Error("Legacy string format");
        }
      } catch (e) {
        // Migration for legacy string-based sessions
        const extMap = {
          javascript: "js",
          typescript: "ts",
          python: "py",
          html: "html",
          css: "css",
        };
        const ext = extMap[currentSession.language] || "txt";
        const fileName = `/main.${ext}`;
        const migratedFs = {
          [fileName]: { type: "file", content: currentSession.code },
        };

        setFileSystem(migratedFs);
        setActiveFile(fileName);
        setOpenFiles([fileName]);
        useSessionStore
          .getState()
          .updateSessionFileSystem(currentSession.id, migratedFs);
      }
    }
  }, [currentSession, fileSystem]);

  useEffect(() => {
    if (!fileSystem || !activeFile || !fileSystem[activeFile]) {
      setEditorCode("");
      return;
    }

    const content = fileSystem[activeFile]?.content;
    setEditorCode(typeof content === "string" ? content : "");
  }, [fileSystem, activeFile]);

  useEffect(() => {
    if (!sessionId || !user || !isSupabaseConfigured()) return;

    // We ALWAYS need to join the collaboration channel for presence
    joinCollaboration(sessionId, user);

    // ALWAYS fetch the latest session data from DB when initially entering
    // the route to ensure we have any changes made while we were offline/in dashboard.
    joinSession(sessionId).catch(() => {
      toast.error("Failed to join session");
      navigate("/dashboard");
    });

    return () => {
      leaveCollaboration();
      useSessionStore.getState().setCurrentSession(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      // Global Search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSidebarOpen(true);
        setActiveSidebarTab("search");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!sessionId || !user || !isSupabaseConfigured()) return;

    const channel = useCollaborationStore.getState().channel;
    if (!channel) return;

    const handleDeleted = () => {
      toast.error("This session has been deleted by the owner");
      leaveCollaboration();
      navigate("/dashboard");
    };

    channel.on("broadcast", { event: "session-deleted" }, handleDeleted);
    return () => {};
  }, [sessionId, navigate, leaveCollaboration, collaborators]);

  useEffect(() => {
    useCollaborationStore
      .getState()
      .setOnFileSystemChange((newFs, senderId) => {
        setFileSystem(newFs);
        // Wait, if the active file was deleted, we should handle that.
        if (activeFile && !newFs[activeFile]) {
          setActiveFile(null);
          setOpenFiles((prev) => prev.filter((f) => f !== activeFile));
        }
      });
  }, [activeFile]);

  // FS Mutation handlers
  const saveFsAndBroadcast = (newFs) => {
    setFileSystem(newFs);
    useCollaborationStore.getState().broadcastFileSystemChange(user.id, newFs);
    useSessionStore.getState().updateSessionFileSystem(sessionId, newFs);
  };

  const isValidPathName = (name) => {
    if (!name || typeof name !== "string") return false;
    if (/[<>:"/\\|?*\x00-\x1F]/.test(name) || name === ".." || name === ".")
      return false;
    return true;
  };

  const handleCreateFile = (parentPath, name) => {
    if (!isValidPathName(name)) return toast.error("Invalid file name!");
    const path = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
    if (fileSystem[path]) return toast.error("File already exists!");
    const newFs = { ...fileSystem, [path]: { type: "file", content: "" } };

    // Auto-create parent folders if they dont exist
    const parts = path.split("/").filter(Boolean);
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += `/${parts[i]}`;
      if (!newFs[currentPath]) {
        newFs[currentPath] = { type: "directory" };
      }
    }

    saveFsAndBroadcast(newFs);
    setActiveFile(path);
    if (!openFiles.includes(path)) setOpenFiles([...openFiles, path]);
  };

  const handleCreateFolder = (parentPath, name) => {
    if (!isValidPathName(name)) return toast.error("Invalid folder name!");
    const path = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
    if (fileSystem[path]) return toast.error("Folder already exists!");
    const newFs = { ...fileSystem, [path]: { type: "directory" } };
    saveFsAndBroadcast(newFs);
  };

  const handleRename = (oldPath, newName) => {
    if (!isValidPathName(newName)) return toast.error("Invalid name!");

    const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/")) || "/";
    const newPath =
      parentPath === "/" ? `/${newName}` : `${parentPath}/${newName}`;

    if (newPath === oldPath) return;
    if (fileSystem[newPath]) return toast.error("Name already exists!");

    const newFs = { ...fileSystem };

    // Rename all underlying files/folders if directory
    Object.keys(fileSystem).forEach((key) => {
      if (key === oldPath || key.startsWith(`${oldPath}/`)) {
        const replacementKey = key.replace(oldPath, newPath);
        newFs[replacementKey] = newFs[key];
        delete newFs[key];
      }
    });

    if (activeFile === oldPath || activeFile?.startsWith(`${oldPath}/`)) {
      const replacementActive = activeFile.replace(oldPath, newPath);
      setActiveFile(replacementActive);
    }
    setOpenFiles((prev) =>
      prev.map((p) =>
        p === oldPath || p.startsWith(`${oldPath}/`)
          ? p.replace(oldPath, newPath)
          : p
      )
    );

    saveFsAndBroadcast(newFs);
  };

  const handleDelete = (path) => {
    const newFs = { ...fileSystem };
    
    Object.keys(fileSystem).forEach(key => {
      if (key === path || key.startsWith(`${path}/`)) {
        delete newFs[key];
        setOpenFiles(prev => prev.filter(p => p !== key));
        if (activeFile === key) setActiveFile(null);
      }
    });
    
    saveFsAndBroadcast(newFs);
    toast.success(`${path.split('/').pop()} deleted`);
  };

  const handleMove = (draggedPath, targetFolderPath) => {
    const fileName = draggedPath.split("/").pop();
    const newPath =
      targetFolderPath === "/"
        ? `/${fileName}`
        : `${targetFolderPath}/${fileName}`;
    if (newPath === draggedPath || fileSystem[newPath]) return;

    const newFs = { ...fileSystem };

    Object.keys(fileSystem).forEach((key) => {
      if (key === draggedPath || key.startsWith(`${draggedPath}/`)) {
        const replacementKey = key.replace(draggedPath, newPath);
        newFs[replacementKey] = newFs[key];
        delete newFs[key];
      }
    });

    if (
      activeFile === draggedPath ||
      activeFile?.startsWith(`${draggedPath}/`)
    ) {
      const replacementActive = activeFile.replace(draggedPath, newPath);
      setActiveFile(replacementActive);
    }
    setOpenFiles((prev) =>
      prev.map((p) =>
        p === draggedPath || p.startsWith(`${draggedPath}/`)
          ? p.replace(draggedPath, newPath)
          : p
      )
    );

    saveFsAndBroadcast(newFs);
  };

  const handleSearchResultClick = (path, line, column, length) => {
    if (!openFiles.includes(path)) {
      setOpenFiles((prev) => [...prev, path]);
    }
    setActiveFile(path);
    setNavigationTarget({ path, line, column, length, ts: Date.now() });
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/session/${sessionId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !currentSession) {
    return (
      <div
        id="session-loading"
        className="min-h-screen bg-neutral-950 flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-neutral-400 font-display">
            Loading session...
          </span>
        </div>
      </div>
    );
  }

  const langMeta = getLangMeta(currentSession.language);
  const LangIcon = langMeta.icon;

  const toggleSidebar = (tab) => {
    if (activeSidebarTab === tab && sidebarOpen) {
      setSidebarOpen(false);
    } else {
      setActiveSidebarTab(tab);
      setSidebarOpen(true);
    }
  };

  return (
    <div
      id="session-page"
      className="h-screen bg-neutral-950 flex flex-col overflow-hidden"
    >
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#18181b",
            color: "#fafafa",
            border: "1px solid #27272a",
          },
        }}
      />

      {/* Title Bar */}
      <header className="h-12 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-3 select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-400" />
          </button>

          <div className="w-px h-5 bg-neutral-800" />

          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: langMeta.color + "18" }}
            >
              <LangIcon
                className="w-3.5 h-3.5"
                style={{ color: langMeta.color }}
              />
            </div>
            <h1 className="text-sm font-medium text-white font-display">
              {currentSession.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Collaborators */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-neutral-800 border border-neutral-700/50">
            <div className="flex -space-x-1.5">
              {collaborators.slice(0, 4).map((collab) => (
                <div
                  key={collab.id}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-neutral-900"
                  style={{ backgroundColor: collab.color }}
                  title={collab.name}
                >
                  {collab.name?.[0]?.toUpperCase() || "?"}
                </div>
              ))}
            </div>
            <span className="text-xs text-neutral-400">
              {collaborators.length}
            </span>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700/50 hover:bg-neutral-700 transition-colors text-xs"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-accent-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-neutral-400" />
            )}
            <span className="text-neutral-300">
              {copied ? "Copied" : "Share"}
            </span>
          </button>

          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs font-medium ${
              isTerminalOpen
                ? "bg-neutral-800 border-neutral-700 text-white"
                : "bg-transparent border-neutral-700/50 text-neutral-400 hover:text-white hover:border-neutral-600"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Terminal
          </button>

          <button
            onClick={() => setIsAiChatOpen(!isAiChatOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 transition-colors text-xs font-semibold text-neutral-950"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar */}
        <div className="w-12 bg-[#121215] border-r border-neutral-800 flex flex-col items-center py-2 justify-between flex-shrink-0">
          <div className="flex flex-col items-center gap-1">
            <SidebarIcon
              icon={FolderOpen}
              label="Explorer"
              active={activeSidebarTab === "files" && sidebarOpen}
              onClick={() => toggleSidebar("files")}
            />
            <SidebarIcon
              icon={Search}
              label="Search"
              active={activeSidebarTab === "search" && sidebarOpen}
              onClick={() => toggleSidebar("search")}
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <SidebarIcon
              icon={Settings}
              label="Settings"
              active={false}
              onClick={() => navigate("/settings")}
            />
          </div>
        </div>

        {/* Sidebar Panel */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="bg-[#121215] border-r border-neutral-800 overflow-hidden flex-shrink-0"
            >
              <div className="w-60 h-full flex flex-col">
                <div className="h-9 flex items-center px-4 border-b border-neutral-800">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider font-display">
                    {activeSidebarTab === "files" && "Explorer"}
                    {activeSidebarTab === "search" && "Search"}
                  </span>
                </div>

                {activeSidebarTab === "files" && fileSystem && (
                  <div className="flex-1 overflow-hidden">
                    <FileTree
                      fileSystem={fileSystem}
                      activeFile={activeFile}
                      onSelectFile={(path) => {
                        setActiveFile(path);
                        const content = fileSystem[path]?.content;
                        setEditorCode(typeof content === "string" ? content : "");
                        if (!openFiles.includes(path))
                          setOpenFiles([...openFiles, path]);
                      }}
                      onCreateFile={handleCreateFile}
                      onCreateFolder={handleCreateFolder}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onMove={handleMove}
                    />
                  </div>
                )}

                {activeSidebarTab === "search" && (
                  <SearchPanel 
                    fileSystem={fileSystem} 
                    onResultClick={handleSearchResultClick} 
                    autoFocus={activeSidebarTab === "search"}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="h-9 bg-[#121215] border-b border-neutral-800 flex items-center flex-shrink-0 px-2 gap-1 overflow-x-auto">
            {openFiles.length === 0 && (
              <span className="text-xs text-neutral-500 px-2 italic">
                No files open
              </span>
            )}
            {openFiles.map((path) => {
              const isActive = path === activeFile;
              const name = path.split("/").pop();
              return (
                <div
                  key={path}
                  onClick={() => setActiveFile(path)}
                  className={`flex items-center gap-1.5 px-3 h-full border-r border-l border-t-2 text-xs cursor-pointer group shrink-0 ${
                    isActive
                      ? "bg-neutral-950 border-neutral-800 border-t-accent-500 text-neutral-200"
                      : "bg-[#18181c] border-transparent border-t-transparent text-neutral-500 hover:bg-[#1f1f24]"
                  }`}
                >
                  <span className="font-medium truncate max-w-[120px]">
                    {name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextOpen = openFiles.filter((p) => p !== path);
                      setOpenFiles(nextOpen);
                      if (isActive) setActiveFile(nextOpen[0] || null);
                    }}
                    className="p-0.5 rounded-sm hover:bg-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Breadcrumb */}
          <div className="h-7 bg-neutral-950 border-b border-neutral-800 flex items-center px-4 gap-1.5 flex-shrink-0 text-[11px] text-neutral-500 font-mono tracking-tight">
            {activeFile
              ? activeFile.replace(/^\//, "").split("/").join("  >  ")
              : "No File Selected"}
          </div>

          {/* Code editor */}
          <div className="flex-1 overflow-hidden">
            {fileSystem && activeFile ? (
              <CodeEditor
                ref={editorRef}
                sessionId={sessionId}
                fileSystem={fileSystem}
                activeFile={activeFile}
                navigationTarget={navigationTarget}
                onCursorChange={setCursorPos}
                onRunSelectionInNewTerminal={handleRunSelectionInNewTerminal}
                onContentChange={(changes, newContent) => {
                  const newFs = {
                    ...fileSystem,
                    [activeFile]: {
                      ...fileSystem[activeFile],
                      content: newContent,
                    },
                  };
                  setFileSystem(newFs);
                  setEditorCode(newContent);

                  // Only save to DB for local edits (changes array is non-empty)
                  if (changes.length > 0) {
                    clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = setTimeout(() => {
                      useSessionStore.getState().updateSessionFileSystem(sessionId, newFs);
                    }, 1500);
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
                No active file. Select a file from the explorer.
              </div>
            )}
          </div>

          {/* Terminal Panel */}
          <TerminalPanel
            ref={terminalRef}
            language={currentSession.language}
            code={editorCode}
            hostUserId={currentSession.user_id}
            isOpen={isTerminalOpen}
            onToggle={() => setIsTerminalOpen(false)}
          />
        </div>

        <AiChat
          isOpen={isAiChatOpen}
          onClose={() => setIsAiChatOpen(false)}
          code={currentSession.code}
          onApplyCode={handleApplyAiCode}
        />
      </div>

      {/* Status Bar */}
      <footer className="h-7 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between px-3 select-none flex-shrink-0 text-[11px]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-500" />
            <span className="text-neutral-400">
              {collaborators.length} online
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-neutral-500">
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span>UTF-8</span>
          <span style={{ color: langMeta.color }} className="uppercase">
            {currentSession.language}
          </span>
        </div>
      </footer>
    </div>
  );
}
