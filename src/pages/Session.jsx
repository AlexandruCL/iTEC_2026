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
  PanelLeftClose,
  PanelLeft,
  Play,
  MoreVertical,
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
      className={`relative w-12 h-12 flex items-center justify-center transition-colors ${
        active
          ? "text-white before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary-400 before:rounded-r"
          : "text-dark-500 hover:text-dark-300"
      }`}
    >
      <Icon className="w-6 h-6" />
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
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState("files");

  useEffect(() => {
    if (sessionId && user && isSupabaseConfigured()) {
      joinSession(sessionId)
        .then(() => {
          joinCollaboration(sessionId, user);
        })
        .catch(() => {
          toast.error("Failed to join session");
          navigate("/dashboard");
        });
    }

    return () => {
      leaveCollaboration();
    };
  }, [
    sessionId,
    user,
    joinSession,
    joinCollaboration,
    leaveCollaboration,
    navigate,
  ]);

  // Listen for session deletion on the collaboration channel
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

    return () => {
      // Channel cleanup happens in leaveCollaboration, no separate unsub needed
    };
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
        className="min-h-screen bg-[#0d1117] flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-lg font-extralight text-dark-400">
            Loading session...
          </span>
        </div>
      </div>
    );
  }

  const langMeta = getLangMeta(currentSession.language);
  const LangIcon = langMeta.icon;

  return (
    <div
      id="session-page"
      className="h-screen bg-[#0d1117] flex flex-col overflow-hidden"
    >
      <Toaster position="top-center" />

      {/* Title Bar */}
      <header className="h-12 bg-[#161b22] border-b border-[#21262d] flex items-center justify-between px-3 select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-1.5 rounded-md hover:bg-[#21262d] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 text-dark-400 group-hover:text-white transition-colors" />
          </button>

          <div className="w-px h-5 bg-[#21262d]" />

          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded flex items-center justify-center"
              style={{ backgroundColor: langMeta.color + "22" }}
            >
              <LangIcon
                className="w-3 h-3"
                style={{ color: langMeta.color }}
              />
            </div>
            <h1 className="text-lg font-extralight text-dark-200">
              {currentSession.name}
            </h1>
            <span className="text-lg font-extralight text-dark-500">/</span>
            <span
              className="text-lg font-extralight capitalize"
              style={{ color: langMeta.color }}
            >
              {currentSession.language}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Collaborators pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#21262d] border border-[#30363d]">
            <div className="flex -space-x-1.5">
              {collaborators.slice(0, 4).map((collab) => (
                <div
                  key={collab.id}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium text-white border border-[#161b22] ring-1 ring-[#161b22]"
                  style={{ backgroundColor: collab.color }}
                  title={collab.name}
                >
                  {collab.name?.[0]?.toUpperCase() || "?"}
                </div>
              ))}
            </div>
            <span className="text-lg font-extralight text-dark-400">
              {collaborators.length} online
            </span>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-dark-400" />
            )}
            <span className="text-lg font-extralight text-dark-300">
              {copied ? "Copied" : "Share"}
            </span>
          </button>

          <button
            onClick={() => setIsAiChatOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-900/20"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span className="text-lg font-extralight text-white">
              AI Assistant
            </span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar */}
        <div className="w-12 bg-[#161b22] border-r border-[#21262d] flex flex-col items-center pt-2 pb-2 justify-between flex-shrink-0">
          <div className="flex flex-col items-center gap-1">
            <SidebarIcon
              icon={FolderOpen}
              label="Explorer"
              active={activeSidebarTab === "files" && sidebarOpen}
              onClick={() => {
                if (activeSidebarTab === "files" && sidebarOpen) {
                  setSidebarOpen(false);
                } else {
                  setActiveSidebarTab("files");
                  setSidebarOpen(true);
                }
              }}
            />
            <SidebarIcon
              icon={Search}
              label="Search"
              active={activeSidebarTab === "search" && sidebarOpen}
              onClick={() => {
                if (activeSidebarTab === "search" && sidebarOpen) {
                  setSidebarOpen(false);
                } else {
                  setActiveSidebarTab("search");
                  setSidebarOpen(true);
                }
              }}
            />
            <SidebarIcon
              icon={GitBranch}
              label="Source Control"
              active={activeSidebarTab === "git" && sidebarOpen}
              onClick={() => {
                if (activeSidebarTab === "git" && sidebarOpen) {
                  setSidebarOpen(false);
                } else {
                  setActiveSidebarTab("git");
                  setSidebarOpen(true);
                }
              }}
            />
            <SidebarIcon
              icon={Layers}
              label="Extensions"
              active={activeSidebarTab === "extensions" && sidebarOpen}
              onClick={() => {
                if (activeSidebarTab === "extensions" && sidebarOpen) {
                  setSidebarOpen(false);
                } else {
                  setActiveSidebarTab("extensions");
                  setSidebarOpen(true);
                }
              }}
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
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="bg-[#161b22] border-r border-[#21262d] overflow-hidden flex-shrink-0"
            >
              <div className="w-60 h-full flex flex-col">
                <div className="h-9 flex items-center justify-between px-4">
                  <span className="text-lg font-extralight text-dark-400 uppercase tracking-wider">
                    {activeSidebarTab === "files" && "Explorer"}
                    {activeSidebarTab === "search" && "Search"}
                    {activeSidebarTab === "git" && "Source Control"}
                    {activeSidebarTab === "extensions" && "Extensions"}
                  </span>
                </div>

                {activeSidebarTab === "files" && (
                  <div className="flex-1 px-2 py-1 overflow-y-auto">
                    <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-[#1f2937]/50 text-white">
                      <ChevronRight className="w-3.5 h-3.5 text-dark-400" />
                      <FolderOpen className="w-3.5 h-3.5 text-primary-400" />
                      <span className="text-lg font-extralight truncate">
                        {currentSession.name}
                      </span>
                    </div>

                    <div className="ml-4 mt-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1f6feb22] border-l-2 border-primary-500">
                        <LangIcon
                          className="w-3.5 h-3.5"
                          style={{ color: langMeta.color }}
                        />
                        <span className="text-lg font-extralight text-white truncate">
                          main.{langMeta.label.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeSidebarTab === "search" && (
                  <div className="px-3 pt-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#0d1117] border border-[#30363d]">
                      <Search className="w-3.5 h-3.5 text-dark-500" />
                      <span className="text-lg font-extralight text-dark-500">
                        Search
                      </span>
                    </div>
                  </div>
                )}

                {activeSidebarTab === "git" && (
                  <div className="px-3 pt-2 flex flex-col items-center justify-center h-32 gap-2">
                    <GitBranch className="w-8 h-8 text-dark-600" />
                    <span className="text-lg font-extralight text-dark-500 text-center">
                      No source control providers
                    </span>
                  </div>
                )}

                {activeSidebarTab === "extensions" && (
                  <div className="px-3 pt-2 flex flex-col items-center justify-center h-32 gap-2">
                    <Layers className="w-8 h-8 text-dark-600" />
                    <span className="text-lg font-extralight text-dark-500 text-center">
                      No extensions installed
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="h-9 bg-[#0d1117] border-b border-[#21262d] flex items-center flex-shrink-0">
            <div className="flex items-center h-full">
              <div className="flex items-center gap-1.5 px-4 h-full bg-[#161b22] border-r border-[#21262d] border-b-2 border-b-primary-500">
                <LangIcon
                  className="w-3.5 h-3.5"
                  style={{ color: langMeta.color }}
                />
                <span className="text-lg font-extralight text-white">
                  main.{langMeta.label.toLowerCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="h-6 bg-[#161b22] border-b border-[#21262d] flex items-center px-4 gap-1 flex-shrink-0">
            <span className="text-lg font-extralight text-dark-400">
              {currentSession.name}
            </span>
            <ChevronRight className="w-3 h-3 text-dark-600" />
            <span
              className="text-lg font-extralight"
              style={{ color: langMeta.color }}
            >
              main.{langMeta.label.toLowerCase()}
            </span>
          </div>

          {/* Code editor */}
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              sessionId={sessionId}
              initialCode={currentSession.code}
              language={currentSession.language}
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <footer className="h-6 bg-[#0d1117] border-t border-[#21262d] flex items-center justify-between px-3 select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5 text-dark-400" />
            <span className="text-lg font-extralight text-dark-400">main</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-lg font-extralight text-dark-400">
              {collaborators.length} connected
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-lg font-extralight text-dark-400">
            Ln 1, Col 1
          </span>
          <span className="text-lg font-extralight text-dark-400">
            Spaces: 2
          </span>
          <span className="text-lg font-extralight text-dark-400">UTF-8</span>
          <span
            className="text-lg font-extralight capitalize"
            style={{ color: langMeta.color }}
          >
            {currentSession.language}
          </span>
        </div>
      </footer>

      <AiChat
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        code={currentSession.code}
      />
    </div>
  );
}
