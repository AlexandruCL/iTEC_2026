import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useCollaborationStore } from "@/stores/collaborationStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import CodeEditor from "@/components/editor/CodeEditor";
import TerminalPanel from "@/components/editor/TerminalPanel";
import AiChat from "@/components/ai/AiChat";
import Button from "@/components/ui/Button";
import toast, { Toaster } from "react-hot-toast";

const LANGUAGE_ICONS = {
  javascript: { icon: Braces, color: "#f7df1e", label: "JS" },
  typescript: { icon: Braces, color: "#3178c6", label: "TS" },
  python: { icon: FileCode, color: "#3776ab", label: "PY" },
  html: { icon: Code2, color: "#e34c26", label: "HTML" },
  css: { icon: Code2, color: "#264de4", label: "CSS" },
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

  useEffect(() => {
    if (!sessionId || !user || !isSupabaseConfigured()) return;

    // Don't re-join if we already have this session loaded
    const store = useSessionStore.getState();
    if (store.currentSession?.id === sessionId) return;

    joinSession(sessionId)
      .then(() => {
        joinCollaboration(sessionId, user);
      })
      .catch(() => {
        toast.error("Failed to join session");
        navigate("/dashboard");
      });

    return () => {
      leaveCollaboration();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !isSupabaseConfigured()) return;

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
                    {activeSidebarTab === "extensions" && "Extensions"}
                  </span>
                </div>

                {activeSidebarTab === "files" && (
                  <div className="flex-1 px-2 py-2 overflow-y-auto">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded text-white text-xs">
                      <ChevronRight className="w-3 h-3 text-neutral-500" />
                      <FolderOpen className="w-3 h-3 text-accent-400" />
                      <span className="truncate font-medium">
                        {currentSession.name}
                      </span>
                    </div>
                    <div className="ml-4 mt-0.5">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent-500/10 text-white text-xs">
                        <LangIcon
                          className="w-3 h-3"
                          style={{ color: langMeta.color }}
                        />
                        <span className="truncate font-medium">
                          main.{langMeta.label.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeSidebarTab === "search" && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-500">
                      <Search className="w-3 h-3" />
                      Search
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="h-9 bg-[#121215] border-b border-neutral-800 flex items-center flex-shrink-0">
            <div className="flex items-center gap-1.5 px-4 h-full bg-neutral-950 border-r border-neutral-800 border-t-2 border-t-accent-500 text-xs">
              <LangIcon
                className="w-3.5 h-3.5"
                style={{ color: langMeta.color }}
              />
              <span className="text-neutral-200 font-medium">
                main.{langMeta.label.toLowerCase()}
              </span>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="h-7 bg-neutral-950 border-b border-neutral-800 flex items-center px-4 gap-1.5 flex-shrink-0 text-xs">
            <span className="text-neutral-500">{currentSession.name}</span>
            <ChevronRight className="w-3 h-3 text-neutral-600" />
            <span style={{ color: langMeta.color }}>
              main.{langMeta.label.toLowerCase()}
            </span>
          </div>

          {/* Code editor */}
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              sessionId={sessionId}
              initialCode={currentSession.code}
              language={currentSession.language}
              onCursorChange={setCursorPos}
            />
          </div>

          {/* Terminal Panel */}
          <TerminalPanel
            language={currentSession.language}
            code={currentSession.code}
            isOpen={isTerminalOpen}
            onToggle={() => setIsTerminalOpen(false)}
          />
        </div>

        <AiChat
          isOpen={isAiChatOpen}
          onClose={() => setIsAiChatOpen(false)}
          code={currentSession.code}
        />
      </div>

      {/* Status Bar */}
      <footer className="h-7 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between px-3 select-none flex-shrink-0 text-[11px]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 cursor-pointer hover:bg-neutral-800 py-0.5 px-1.5 rounded transition-colors">
            <GitBranch className="w-3 h-3 text-neutral-400" />
            <span className="text-neutral-400">main</span>
          </div>
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
