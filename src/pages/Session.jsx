import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";
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
  Loader2,
  Wand2,
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
import Modal from "@/components/ui/Modal";
import toast, { Toaster } from "react-hot-toast";

const LANGUAGE_ICONS = {
  javascript: { icon: Braces, color: "#f7df1e", label: "JS" },
  python: { icon: FileCode, color: "#3776ab", label: "PY" },
  default: { icon: FileCode, color: "#94a3b8", label: "FILE" },
};

const SYSTEM_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const DEFAULT_MODEL = "gemini-2.5-flash";

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
  const { user, aiConfig, isAiConfigExpired, resetAiConfig } = useAuthStore();
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
  const [isUploadSourceModalOpen, setIsUploadSourceModalOpen] = useState(false);
  const [isHiddenFilesModalOpen, setIsHiddenFilesModalOpen] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [decisionJoke, setDecisionJoke] = useState({
    open: false,
    title: "",
    line: "",
  });
  const [inlineEdit, setInlineEdit] = useState({
    open: false,
    instruction: "",
    loading: false,
    suggestion: "",
    error: "",
    selection: null,
    position: { x: 24, y: 120 },
  });

  const editorRef = useRef(null);
  const terminalRef = useRef(null);
  const saveTimerRef = useRef(null);
  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const inlineEditInputRef = useRef(null);

  const expiredAiConfig = aiConfig.useCustom && isAiConfigExpired();
  useEffect(() => {
    if (expiredAiConfig) {
      resetAiConfig();
    }
  }, [expiredAiConfig, resetAiConfig]);

  const effectiveAiKey =
    !expiredAiConfig && aiConfig.useCustom && aiConfig.apiKey
      ? aiConfig.apiKey
      : SYSTEM_GEMINI_KEY;
  const effectiveAiModel =
    !expiredAiConfig && aiConfig.useCustom && aiConfig.model
      ? aiConfig.model
      : DEFAULT_MODEL;

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

  const getInlinePanelPosition = (anchor) => {
    const panelWidth = 360;
    const panelHeight = 240;
    const margin = 12;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const baseX = anchor?.x ?? viewportWidth / 2 - panelWidth / 2;
    const baseY = anchor?.y ?? 120;

    const x = Math.max(margin, Math.min(baseX, viewportWidth - panelWidth - margin));

    let y = baseY + 8;
    if (y + panelHeight > viewportHeight - margin) {
      y = (anchor?.y ?? viewportHeight / 2) - panelHeight - 12;
    }
    y = Math.max(margin, Math.min(y, viewportHeight - panelHeight - margin));

    return { x, y };
  };

  const stripCodeFences = (text) => {
    if (!text) return "";
    const trimmed = text.trim();
    if (!trimmed.startsWith("```")) return trimmed;

    const lines = trimmed.split("\n");
    if (lines.length < 2) return trimmed;

    const hasClosing = lines[lines.length - 1].trim().startsWith("```");
    if (!hasClosing) return trimmed;

    return lines.slice(1, -1).join("\n").trim();
  };

  const requestInlineAiReplacement = async ({ selectedCode, instruction, language, fullCode }) => {
    if (!effectiveAiKey) {
      throw new Error(
        "No API key available. Add one in Settings -> AI Configuration.",
      );
    }

    const prompt = [
      "You are an expert coding assistant.",
      "Task: Rewrite the selected code block according to the user's instruction.",
      "Return only the replacement code for the selected block.",
      "Do not return explanations.",
      "Do not include markdown code fences.",
      "Preserve indentation style and language syntax.",
      "",
      `Language: ${language || "plaintext"}`,
      "",
      "Selected code:",
      selectedCode,
      "",
      `Instruction: ${instruction}`,
      "",
      "File context (for reference):",
      fullCode,
    ].join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${effectiveAiModel}:generateContent?key=${effectiveAiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      const detail = errBody?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Gemini API error: ${detail}`);
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      throw new Error("AI did not return any replacement.");
    }

    return stripCodeFences(aiText);
  };

  const openInlineEditFromSelection = (selectionPayload) => {
    if (!selectionPayload?.text?.trim()) {
      toast.error("Select code first, then press Ctrl+I.");
      return;
    }

    setInlineEdit({
      open: true,
      instruction: "",
      loading: false,
      suggestion: "",
      error: "",
      selection: selectionPayload,
      position: getInlinePanelPosition(selectionPayload.anchor),
    });
  };

  const closeInlineEdit = () => {
    setInlineEdit((prev) => ({
      ...prev,
      open: false,
      loading: false,
      suggestion: "",
      error: "",
    }));
    editorRef.current?.focusEditor?.();
  };

  const handleGenerateInlineEdit = async () => {
    const selection = inlineEdit.selection;
    const instruction = inlineEdit.instruction.trim();

    if (!selection?.text?.trim()) {
      toast.error("No valid selection found.");
      return;
    }

    if (!instruction) {
      toast.error("Please enter an instruction.");
      return;
    }

    setInlineEdit((prev) => ({ ...prev, loading: true, error: "", suggestion: "" }));

    try {
      const currentFileCode = fileSystem?.[activeFile]?.content || "";
      const suggestion = await requestInlineAiReplacement({
        selectedCode: selection.text,
        instruction,
        language: currentSession?.language,
        fullCode: currentFileCode,
      });

      if (!suggestion.trim()) {
        throw new Error("AI returned an empty replacement.");
      }

      setInlineEdit((prev) => ({
        ...prev,
        loading: false,
        suggestion,
      }));
    } catch (error) {
      setInlineEdit((prev) => ({
        ...prev,
        loading: false,
        error: error.message || "Failed to generate replacement.",
      }));
    }
  };

  const handleApplyInlineReplacement = () => {
    if (!inlineEdit.suggestion.trim()) return;
    if (!inlineEdit.selection?.range) return;

    if (inlineEdit.selection.path !== activeFile) {
      toast.error("Open the original file before applying this replacement.");
      return;
    }

    const applied = editorRef.current?.replaceRangeText?.(
      inlineEdit.selection.range,
      inlineEdit.suggestion,
    );

    if (!applied) {
      toast.error("Could not apply replacement.");
      return;
    }

    toast.success("Selected block replaced by AI.");
    closeInlineEdit();
  };

  useEffect(() => {
    if (!inlineEdit.open) return;
    const timer = setTimeout(() => {
      inlineEditInputRef.current?.focus();
    }, 50);

    return () => clearTimeout(timer);
  }, [inlineEdit.open]);

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

  const isHiddenPath = (path) => {
    const parts = path.split("/").filter(Boolean);
    return parts.some((part) => part.startsWith("."));
  };

  const getDescriptorPath = (descriptor) => {
    return (
      descriptor?.relativePath ||
      descriptor?.webkitRelativePath ||
      descriptor?.name ||
      null
    );
  };

  const asFileObject = (descriptor) => descriptor?.file || descriptor;

  const normalizeImportedPath = (rawPath) => {
    if (!rawPath || typeof rawPath !== "string") return null;
    const cleaned = rawPath
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/");

    if (!cleaned) return null;

    const parts = cleaned.split("/").filter(Boolean);
    if (!parts.length) return null;
    if (parts.some((part) => part === "." || part === "..")) return null;
    if (!parts.every((part) => isValidPathName(part))) return null;

    return `/${parts.join("/")}`;
  };

  const removePathAndChildren = (fsMap, path) => {
    Object.keys(fsMap).forEach((key) => {
      if (key === path || key.startsWith(`${path}/`)) {
        delete fsMap[key];
      }
    });
  };

  const ensureParentDirectories = (fsMap, filePath) => {
    const parts = filePath.split("/").filter(Boolean);
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += `/${parts[i]}`;
      if (!fsMap[currentPath]) {
        fsMap[currentPath] = { type: "directory" };
      } else if (fsMap[currentPath].type !== "directory") {
        removePathAndChildren(fsMap, currentPath);
        fsMap[currentPath] = { type: "directory" };
      }
    }
  };

  const importFilesIntoSession = async (selectedFiles, { includeHidden = true } = {}) => {
    if (!fileSystem) return;
    if (!selectedFiles?.length) return;

    const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
    let totalBytes = 0;
    let importedCount = 0;
    let skippedCount = 0;
    let overwrittenCount = 0;
    const newFs = { ...fileSystem };

    for (const descriptor of selectedFiles) {
      const file = asFileObject(descriptor);
      if (!file) {
        skippedCount += 1;
        continue;
      }

      const candidatePath = getDescriptorPath(descriptor);
      const normalizedPath = normalizeImportedPath(candidatePath);

      if (!normalizedPath) {
        skippedCount += 1;
        continue;
      }

      if (!includeHidden && isHiddenPath(normalizedPath)) {
        skippedCount += 1;
        continue;
      }

      totalBytes += file.size || 0;
      if (totalBytes > MAX_IMPORT_BYTES) {
        toast.error("Import too large. Keep it under 8MB per upload.");
        break;
      }

      let content = "";
      try {
        content = await file.text();
      } catch {
        skippedCount += 1;
        continue;
      }

      ensureParentDirectories(newFs, normalizedPath);

      const existed = !!newFs[normalizedPath];
      if (newFs[normalizedPath]?.type === "directory") {
        removePathAndChildren(newFs, normalizedPath);
      }

      newFs[normalizedPath] = { type: "file", content };
      importedCount += 1;
      if (existed) overwrittenCount += 1;
    }

    if (!importedCount && skippedCount) {
      toast.error("No files were imported.");
      return;
    }

    saveFsAndBroadcast(newFs);

    if (importedCount > 0) {
      const firstImported = Object.keys(newFs).find((path) => newFs[path]?.type === "file");
      if (firstImported && !activeFile) {
        setActiveFile(firstImported);
        setOpenFiles((prev) => (prev.includes(firstImported) ? prev : [...prev, firstImported]));
      }
    }

    const summary = [`Imported ${importedCount} file${importedCount === 1 ? "" : "s"}`];
    if (overwrittenCount > 0) summary.push(`${overwrittenCount} overwritten`);
    if (skippedCount > 0) summary.push(`${skippedCount} skipped`);
    toast.success(summary.join(" • "));
  };

  const makeUploadDescriptorsFromInput = (files) => {
    return Array.from(files || []).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
      name: file.name,
      size: file.size,
    }));
  };

  const fileFromEntry = (entry) =>
    new Promise((resolve, reject) => {
      entry.file(resolve, reject);
    });

  const readDirectoryEntries = async (dirEntry) => {
    const reader = dirEntry.createReader();
    const entries = [];

    // readEntries returns chunks, so we need to loop until empty.
    while (true) {
      const chunk = await new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });

      if (!chunk.length) break;
      entries.push(...chunk);
    }

    return entries;
  };

  const flattenDroppedEntry = async (entry, parentPath = "") => {
    if (!entry) return [];

    if (entry.isFile) {
      const file = await fileFromEntry(entry);
      const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      return [
        {
          file,
          relativePath: currentPath,
          name: file.name,
          size: file.size,
        },
      ];
    }

    if (entry.isDirectory) {
      const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      const children = await readDirectoryEntries(entry);
      const flattened = await Promise.all(
        children.map((child) => flattenDroppedEntry(child, currentPath)),
      );
      return flattened.flat();
    }

    return [];
  };

  const extractDroppedUploadDescriptors = async (dropEvent) => {
    const dt = dropEvent?.dataTransfer;
    if (!dt) return [];

    const items = Array.from(dt.items || []);
    const entryItems = items
      .map((item) => item.webkitGetAsEntry?.())
      .filter(Boolean);

    if (entryItems.length > 0) {
      const flattened = await Promise.all(
        entryItems.map((entry) => flattenDroppedEntry(entry)),
      );
      return flattened.flat();
    }

    return Array.from(dt.files || []).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
      name: file.name,
      size: file.size,
    }));
  };

  const openHiddenFilesModal = (transferPayload) => {
    setPendingTransfer(transferPayload);
    setIsHiddenFilesModalOpen(true);
  };

  const handleUploadFilesSelected = (event) => {
    const descriptors = makeUploadDescriptorsFromInput(event.target.files);
    event.target.value = "";
    setIsUploadSourceModalOpen(false);
    if (!descriptors.length) return;
    openHiddenFilesModal({ type: "upload", descriptors });
  };

  const handleUploadFolderSelected = (event) => {
    const descriptors = makeUploadDescriptorsFromInput(event.target.files);
    event.target.value = "";
    setIsUploadSourceModalOpen(false);
    if (!descriptors.length) return;
    openHiddenFilesModal({ type: "upload", descriptors });
  };

  const handleUploadDrop = async (event) => {
    const descriptors = await extractDroppedUploadDescriptors(event);
    if (!descriptors.length) {
      toast.error("Could not read dropped files.");
      return;
    }
    openHiddenFilesModal({ type: "upload", descriptors });
  };

  const handleRequestUpload = () => {
    setIsUploadSourceModalOpen(true);
  };

  const handleRequestDownload = () => {
    openHiddenFilesModal({ type: "download" });
  };

  const openDecisionJoke = (includeHidden) => {
    if (includeHidden) {
      setDecisionJoke({
        open: true,
        title: "Dotfiles Approved",
        line: "You included .env files. Bold move. Schrödinger's deployment now both works and breaks until CI observes it.",
      });
      return;
    }

    setDecisionJoke({
      open: true,
      title: "Stealth Mode Enabled",
      line: "You skipped hidden files. Your code is clean, your secrets are safe, and one future teammate is still wondering where config went.",
    });
  };

  const handleHiddenFilesDecision = async (includeHidden) => {
    const transfer = pendingTransfer;
    setIsHiddenFilesModalOpen(false);
    setPendingTransfer(null);

    if (!transfer) return;

    openDecisionJoke(includeHidden);

    if (transfer.type === "upload") {
      await importFilesIntoSession(transfer.descriptors, { includeHidden });
      return;
    }

    if (transfer.type === "download") {
      await handleDownloadSession({ includeHidden });
    }
  };

  const handleDownloadSession = async ({ includeHidden = true } = {}) => {
    if (!fileSystem) return;

    const zip = new JSZip();
    let added = 0;

    Object.entries(fileSystem).forEach(([path, node]) => {
      if (path === "/") return;
      if (!includeHidden && isHiddenPath(path)) return;

      const relativePath = path.replace(/^\//, "");
      if (!relativePath) return;

      if (node.type === "directory") {
        zip.folder(relativePath);
        return;
      }

      if (node.type === "file") {
        zip.file(relativePath, typeof node.content === "string" ? node.content : "");
        added += 1;
      }
    });

    if (!added) {
      toast.error("No files available to download.");
      return;
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const safeName = (currentSession?.name || "session")
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "session";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${safeName}-${timestamp}.zip`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${added} file${added === 1 ? "" : "s"} as ZIP`);
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

      <input
        ref={filesInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUploadFilesSelected}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleUploadFolderSelected}
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
                      onRequestUpload={handleRequestUpload}
                      onRequestDownload={handleRequestDownload}
                      onUploadDrop={handleUploadDrop}
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
                onInlineAiEditRequest={openInlineEditFromSelection}
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

          {inlineEdit.open && (
            <div
              className="fixed z-[70] w-[22rem] rounded-xl border border-neutral-700 bg-neutral-900/95 backdrop-blur shadow-2xl shadow-black/40"
              style={{
                left: `${inlineEdit.position.x}px`,
                top: `${inlineEdit.position.y}px`,
              }}
            >
              <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-accent-400" />
                  <span className="text-xs font-semibold text-neutral-200">Inline AI Edit</span>
                </div>
                <button
                  onClick={closeInlineEdit}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3 space-y-2.5">
                <textarea
                  ref={inlineEditInputRef}
                  value={inlineEdit.instruction}
                  onChange={(e) =>
                    setInlineEdit((prev) => ({ ...prev, instruction: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleGenerateInlineEdit();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      closeInlineEdit();
                    }
                  }}
                  rows={3}
                  placeholder="Tell AI how to rewrite this selection..."
                  className="w-full px-2.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-md text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 resize-none"
                />

                {inlineEdit.error && (
                  <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-2.5 py-2">
                    {inlineEdit.error}
                  </p>
                )}

                {inlineEdit.suggestion && (
                  <div className="rounded-md border border-neutral-800 bg-neutral-950/70">
                    <div className="px-2.5 py-1.5 border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                      Replacement preview
                    </div>
                    <pre className="max-h-32 overflow-auto px-2.5 py-2 text-[11px] leading-5 text-neutral-200 font-mono">
                      <code>{inlineEdit.suggestion}</code>
                    </pre>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500">
                    Enter instruction, then Generate. Ctrl/Cmd+Enter also works.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={closeInlineEdit}>
                      Cancel
                    </Button>
                    {!inlineEdit.suggestion ? (
                      <Button
                        size="sm"
                        onClick={handleGenerateInlineEdit}
                        disabled={inlineEdit.loading || !inlineEdit.instruction.trim()}
                      >
                        {inlineEdit.loading ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Generating
                          </span>
                        ) : (
                          "Generate"
                        )}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleApplyInlineReplacement}>
                        Replace Selection
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Terminal Panel */}
          <TerminalPanel
            ref={terminalRef}
            language={currentSession.language}
            code={editorCode}
            hostUserId={currentSession.user_id}
            sessionId={sessionId}
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

      <Modal
        isOpen={isUploadSourceModalOpen}
        onClose={() => setIsUploadSourceModalOpen(false)}
        title="Choose Upload Source"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">
            Import wizard online. Pick your loot source.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => filesInputRef.current?.click()}
            >
              Upload Files
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => folderInputRef.current?.click()}
            >
              Upload Folder
            </Button>
          </div>
          <p className="text-xs text-neutral-500">
            Pro tip: you can also drag files or folders directly into Explorer.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={isHiddenFilesModalOpen}
        onClose={() => {
          setIsHiddenFilesModalOpen(false);
          setPendingTransfer(null);
        }}
        title="Hidden Files Protocol"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">
            Include hidden files like <span className="font-mono text-accent-300">.env</span> and <span className="font-mono text-accent-300">.gitignore</span>?
          </p>
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsHiddenFilesModalOpen(false);
                setPendingTransfer(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleHiddenFilesDecision(false)}
            >
              Skip Hidden Files
            </Button>
            <Button
              size="sm"
              onClick={() => handleHiddenFilesDecision(true)}
            >
              Include Hidden Files
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={decisionJoke.open}
        onClose={() => setDecisionJoke({ open: false, title: "", line: "" })}
        title={decisionJoke.title}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-3 text-sm text-neutral-300 leading-relaxed">
            {decisionJoke.line}
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setDecisionJoke({ open: false, title: "", line: "" })}
            >
              Nice
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
