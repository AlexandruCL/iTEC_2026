import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import Editor from "@monaco-editor/react";
import { useCollaborationStore } from "@/stores/collaborationStore";
import { useAuthStore } from "@/stores/authStore";
import { useSessionStore } from "@/stores/sessionStore";

const CodeEditor = forwardRef(function CodeEditor({
  sessionId,
  fileSystem,
  activeFile,
  language = "javascript", // fallback
  readOnly = false,
  navigationTarget,
  onCursorChange,
  onContentChange,
  onSnippetSelectionChange,
  onRunSelectionInNewTerminal,
  onInlineAiEditRequest,
}, ref) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const modelsRef = useRef({});
  const decorationsRef = useRef([]);
  const lockDecorationsRef = useRef([]);
  const searchDecorationRef = useRef([]);
  const containerRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const fullSyncTimerRef = useRef(null);
  const isRemoteRef = useRef(false);
  const currentLineRef = useRef(null);
  const hasAppendedNewline = useRef(false);
  const lastValidPositionRef = useRef(null);
  const propsRef = useRef({
    activeFile,
    onContentChange,
    onCursorChange,
    onSnippetSelectionChange,
    onRunSelectionInNewTerminal,
    onInlineAiEditRequest,
  });

  useEffect(() => {
    propsRef.current = {
      activeFile,
      onContentChange,
      onCursorChange,
      onSnippetSelectionChange,
      onRunSelectionInNewTerminal,
      onInlineAiEditRequest,
    };
  }, [
    activeFile,
    onContentChange,
    onCursorChange,
    onSnippetSelectionChange,
    onRunSelectionInNewTerminal,
    onInlineAiEditRequest,
  ]);

  const { user } = useAuthStore();
  const { cursors, lockedLines } = useCollaborationStore();

  // Expose imperative methods for AI code insertion
  useImperativeHandle(ref, () => ({
    insertTextAtCursor: (text) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;

      const position = editor.getPosition();
      if (!position) return;

      const range = new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column,
      );

      // executeEdits fires onDidChangeModelContent which broadcasts to collaborators
      editor.executeEdits("ai-insert", [
        { range, text, forceMoveMarkers: true },
      ]);

      // Move cursor to end of inserted text
      const insertedLines = text.split("\n");
      const lastLineLen = insertedLines[insertedLines.length - 1].length;
      const newLine = position.lineNumber + insertedLines.length - 1;
      const newCol =
        insertedLines.length === 1
          ? position.column + lastLineLen
          : lastLineLen + 1;

      editor.setPosition({ lineNumber: newLine, column: newCol });
      editor.focus();
    },
    getSelectedSnippet: () => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      const selection = editor?.getSelection();
      if (!editor || !model || !selection || selection.isEmpty()) {
        return null;
      }

      const text = model.getValueInRange(selection);
      if (!text || !text.trim()) {
        return null;
      }

      const coords = editor.getScrolledVisiblePosition({
        lineNumber: selection.startLineNumber,
        column: selection.startColumn,
      });
      const editorRect = editor.getDomNode()?.getBoundingClientRect();

      return {
        text,
        path: propsRef.current.activeFile,
        range: {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        },
        anchor: coords && editorRect
          ? {
              x: editorRect.left + coords.left,
              y: editorRect.top + coords.top + coords.height,
            }
          : null,
      };
    },
    replaceRangeText: (range, text) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco || !range) return false;

      editor.executeEdits("inline-ai-replace", [
        {
          range: new monaco.Range(
            range.startLineNumber,
            range.startColumn,
            range.endLineNumber,
            range.endColumn,
          ),
          text,
          forceMoveMarkers: true,
        },
      ]);
      editor.focus();
      return true;
    },
    focusEditor: () => {
      editorRef.current?.focus();
    },
  }), []);

  const updateRemoteCursors = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const newDecorations = [];
    const cursorEntries = Object.entries(cursors);

    cursorEntries.forEach(([userId, cursor]) => {
      if (userId === user?.id) return;
      if (cursor.path !== activeFile) return;
      if (!cursor.lineNumber || !cursor.column) return;

      const model = editor.getModel();
      if (!model) return;

      const maxLine = model.getLineCount();
      const line = Math.min(cursor.lineNumber, maxLine);
      const maxCol = model.getLineMaxColumn(line);
      const col = Math.min(cursor.column, maxCol);

      newDecorations.push({
        range: new monaco.Range(line, col, line, col),
        options: {
          className: `remote-cursor-${userId.replace(/[^a-zA-Z0-9]/g, "")}`,
          beforeContentClassName: `remote-cursor-line-${userId.replace(/[^a-zA-Z0-9]/g, "")}`,
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    });

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations,
    );

    updateCursorNameOverlays();
  }, [cursors, user?.id]);

  const updateLockDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const newDecorations = [];
    const lockEntries = Object.entries(lockedLines);

    lockEntries.forEach(([userId, lock]) => {
      if (userId === user?.id) return;
      if (lock.path !== activeFile) return;
      if (!lock.lineNumber) return;

      const maxLine = model.getLineCount();
      const line = Math.min(lock.lineNumber, maxLine);

      newDecorations.push({
        range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
        options: {
          isWholeLine: true,
          className: `locked-line-bg-${userId.replace(/[^a-zA-Z0-9]/g, "")}`,
          glyphMarginClassName: `locked-line-lock-icon-${userId.replace(/[^a-zA-Z0-9]/g, "")}`,
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    });

    lockDecorationsRef.current = editor.deltaDecorations(
      lockDecorationsRef.current,
      newDecorations,
    );
  }, [lockedLines, user?.id]);

  const updateCursorNameOverlays = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const container = containerRef.current;
    if (!container) return;

    container
      .querySelectorAll(".remote-cursor-name-overlay")
      .forEach((el) => el.remove());

    const cursorEntries = Object.entries(cursors);
    cursorEntries.forEach(([userId, cursor]) => {
      if (userId === user?.id) return;
      if (cursor.path !== activeFile) return;
      if (!cursor.lineNumber) return;

      const model = editor.getModel();
      if (!model) return;

      const maxLine = model.getLineCount();
      const line = Math.min(cursor.lineNumber, maxLine);
      const color = cursor.color || "#8b5cf6";

      const topPx = editor.getTopForLineNumber(line) - editor.getScrollTop();
      const editorLayout = editor.getLayoutInfo();
      const lineHeight = editor.getOption(
        monacoRef.current.editor.EditorOption.lineHeight,
      );

      const overlay = document.createElement("div");
      overlay.className = "remote-cursor-name-overlay";
      overlay.style.cssText = `
        position: absolute;
        top: ${topPx}px;
        right: ${editorLayout.verticalScrollbarWidth + editorLayout.minimap.minimapWidth + 8}px;
        height: ${lineHeight}px;
        display: flex;
        align-items: center;
        pointer-events: none;
        z-index: 100;
      `;

      const badge = document.createElement("span");
      badge.textContent = cursor.name;
      badge.style.cssText = `
        background-color: ${color};
        color: white;
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        white-space: nowrap;
      `;

      overlay.appendChild(badge);
      container.appendChild(overlay);
    });
  }, [cursors, user?.id]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const disposable = editor.onDidScrollChange(() => {
      updateCursorNameOverlays();
    });

    return () => disposable.dispose();
  }, [updateCursorNameOverlays]);

  useEffect(() => {
    updateRemoteCursors();
  }, [updateRemoteCursors]);

  useEffect(() => {
    updateLockDecorations();
  }, [updateLockDecorations]);

  useEffect(() => {
    const styleId = "remote-cursor-styles";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const cursorEntries = Object.entries(cursors);
    const lockEntries = Object.entries(lockedLines);
    let css = "";

    cursorEntries.forEach(([userId, cursor]) => {
      if (userId === user?.id) return;
      const safeId = userId.replace(/[^a-zA-Z0-9]/g, "");
      const color = cursor.color || "#8b5cf6";

      css += `
        .remote-cursor-line-${safeId} {
          border-left: 2px solid ${color} !important;
          margin-left: -1px;
        }
        .remote-cursor-label-${safeId} {
          background-color: ${color};
          color: white;
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 500;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          position: relative;
          top: -2px;
          margin-left: 4px;
          pointer-events: none;
        }
      `;
    });

    lockEntries.forEach(([userId, lock]) => {
      if (userId === user?.id) return;
      const safeId = userId.replace(/[^a-zA-Z0-9]/g, "");
      const color = lock.color || "#8b5cf6";

      css += `
        .locked-line-bg-${safeId} {
          background-color: ${color}20 !important;
          border-left: 3px solid ${color} !important;
          cursor: not-allowed !important;
        }
        .locked-line-glyph-${safeId} {
          background-color: ${color}40;
        }
      `;

      css += `
        .locked-line-lock-icon-${safeId}::after {
          content: "🔒";
          font-size: 10px;
          opacity: 0.7;
        }
      `;
    });

    css += `
      .search-match-highlight {
        background-color: rgba(234, 189, 58, 0.4);
        border-radius: 2px;
        transition: background-color 0.5s ease;
      }
    `;

    styleEl.textContent = css;

    return () => { };
  }, [cursors, lockedLines, user?.id]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme("collabcode-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8b949e", fontStyle: "italic" },
        { token: "keyword", foreground: "ff7b72" },
        { token: "keyword.control", foreground: "ff7b72" },
        { token: "string", foreground: "a5d6ff" },
        { token: "number", foreground: "79c0ff" },
        { token: "type", foreground: "ffa657" },
        { token: "type.identifier", foreground: "ffa657" },
        { token: "function", foreground: "d2a8ff" },
        { token: "variable", foreground: "c9d1d9" },
        { token: "variable.predefined", foreground: "79c0ff" },
        { token: "constant", foreground: "79c0ff" },
        { token: "tag", foreground: "7ee787" },
        { token: "attribute.name", foreground: "79c0ff" },
        { token: "attribute.value", foreground: "a5d6ff" },
        { token: "delimiter", foreground: "8b949e" },
        { token: "operator", foreground: "ff7b72" },
        { token: "regexp", foreground: "7ee787" },
      ],
      colors: {
        "editor.background": "#0d1117",
        "editor.foreground": "#c9d1d9",
        "editor.lineHighlightBackground": "#161b2240",
        "editor.lineHighlightBorder": "#21262d",
        "editor.selectionBackground": "#264f7855",
        "editor.selectionHighlightBackground": "#264f7833",
        "editor.inactiveSelectionBackground": "#264f7830",
        "editorCursor.foreground": "#58a6ff",
        "editorIndentGuide.background": "#21262d",
        "editorIndentGuide.activeBackground": "#30363d",
        "editorLineNumber.foreground": "#484f58",
        "editorLineNumber.activeForeground": "#c9d1d9",
        "editorGutter.background": "#0d1117",
        "editorBracketMatch.background": "#264f7855",
        "editorBracketMatch.border": "#58a6ff55",
        "editor.wordHighlightBackground": "#264f7833",
        "editorOverviewRuler.border": "#0000",
        "scrollbar.shadow": "#0000",
        "scrollbarSlider.background": "#484f5833",
        "scrollbarSlider.hoverBackground": "#484f5855",
        "scrollbarSlider.activeBackground": "#484f5877",
        "editorWidget.background": "#161b22",
        "editorWidget.border": "#30363d",
        "editorSuggestWidget.background": "#161b22",
        "editorSuggestWidget.border": "#30363d",
        "editorSuggestWidget.selectedBackground": "#21262d",
        "editorHoverWidget.background": "#161b22",
        "editorHoverWidget.border": "#30363d",
        "minimap.background": "#0d1117",
      },
    });

    monaco.editor.setTheme("collabcode-dark");

    syncModelsWithFileSystem(monaco);

    if (activeFile && modelsRef.current[activeFile]) {
      editor.setModel(modelsRef.current[activeFile]);
    }

    if (!hasAppendedNewline.current) {
      hasAppendedNewline.current = true;
      const model = editor.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        const lastLineContent = model.getLineContent(lineCount);
        const lastCol = model.getLineMaxColumn(lineCount);

        isRemoteRef.current = true;
        editor.executeEdits("auto-newline", [
          {
            range: new monaco.Range(lineCount, lastCol, lineCount, lastCol),
            text: "\n",
            forceMoveMarkers: false,
          },
        ]);
        requestAnimationFrame(() => {
          isRemoteRef.current = false;
        });
      }
    }

    // Helper: check if a specific line is locked by another user
    const isLineLockedForUser = (lineNumber) => {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return false;
      const currentPath = propsRef.current.activeFile;
      const currentLocks = useCollaborationStore.getState().lockedLines;
      for (const [uid, lock] of Object.entries(currentLocks)) {
        if (uid !== currentUser.id && lock.path === currentPath && lock.lineNumber === lineNumber) {
          return true;
        }
      }
      return false;
    };

    // Block keyboard input on locked lines (catches typing, backspace, delete, etc.)
    editor.onKeyDown((e) => {
      if (isRemoteRef.current) return;
      const position = editor.getPosition();
      if (!position) return;

      // Only block content-modifying keys, not navigation
      const isNavigationKey = [
        monaco.KeyCode.UpArrow, monaco.KeyCode.DownArrow,
        monaco.KeyCode.LeftArrow, monaco.KeyCode.RightArrow,
        monaco.KeyCode.Home, monaco.KeyCode.End,
        monaco.KeyCode.PageUp, monaco.KeyCode.PageDown,
        monaco.KeyCode.Escape, monaco.KeyCode.Tab,
      ].includes(e.keyCode);

      // Allow Ctrl/Cmd shortcuts for copy, select all, etc.
      const isModifierShortcut = (e.ctrlKey || e.metaKey) && [
        monaco.KeyCode.KeyC, monaco.KeyCode.KeyA,
        monaco.KeyCode.KeyZ, monaco.KeyCode.KeyF,
        monaco.KeyCode.KeyB, monaco.KeyCode.KeyS,
      ].includes(e.keyCode);

      if (isNavigationKey || isModifierShortcut) return;

      if (isLineLockedForUser(position.lineNumber)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    editor.onDidChangeCursorPosition(() => {
      if (isRemoteRef.current) return;
      if (!editor.hasWidgetFocus()) return; // Prevent focus-stealing when typing elsewhere

      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;

      const position = editor.getPosition();
      if (!position) return;

      const newLine = position.lineNumber;

      if (isLineLockedForUser(newLine)) {
        const prevPos = lastValidPositionRef.current;
        if (prevPos) {
          requestAnimationFrame(() => {
            editor.setPosition(prevPos);
          });
        } else {
          const model = editor.getModel();
          if (model) {
            const totalLines = model.getLineCount();
            let safeLine = null;
            for (let i = totalLines; i >= 1; i--) {
              if (!isLineLockedForUser(i)) {
                safeLine = i;
                break;
              }
            }
            if (safeLine) {
              requestAnimationFrame(() => {
                editor.setPosition({ lineNumber: safeLine, column: 1 });
              });
            }
          }
        }
        return;
      }

      lastValidPositionRef.current = {
        lineNumber: newLine,
        column: position.column,
      };

      if (currentLineRef.current !== newLine) {
        currentLineRef.current = newLine;
        useCollaborationStore
          .getState()
          .broadcastLineLock(
            currentUser.id,
            propsRef.current.activeFile,
            newLine,
            currentUser.user_metadata?.display_name ||
            currentUser.email?.split("@")[0] ||
            "Anonymous",
          );
      }

      useCollaborationStore
        .getState()
        .broadcastCursor(
          currentUser.id,
          propsRef.current.activeFile,
          position.lineNumber,
          position.column,
          currentUser.user_metadata?.display_name ||
          currentUser.email?.split("@")[0] ||
          "Anonymous",
        );

      if (propsRef.current.onCursorChange) {
        propsRef.current.onCursorChange({
          route: propsRef.current.activeFile,
          lineNumber: position.lineNumber,
          column: Math.max(position.column - 1, 0),
        });
      }
    });

    const emitSnippetSelection = () => {
      const model = editor.getModel();
      const selection = editor.getSelection();
      if (!model || !selection || selection.isEmpty()) {
        propsRef.current.onSnippetSelectionChange?.(null);
        return;
      }

      const selectedText = model.getValueInRange(selection);
      if (!selectedText || !selectedText.trim()) {
        propsRef.current.onSnippetSelectionChange?.(null);
        return;
      }

      propsRef.current.onSnippetSelectionChange?.({
        text: selectedText,
        path: propsRef.current.activeFile,
        range: {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        },
      });
    };

    editor.onDidChangeCursorSelection(() => {
      emitSnippetSelection();
    });

    const getCurrentSelectionPayload = () => {
      const model = editor.getModel();
      const selection = editor.getSelection();
      if (!model || !selection || selection.isEmpty()) {
        return null;
      }

      const selectedText = model.getValueInRange(selection);
      if (!selectedText || !selectedText.trim()) {
        return null;
      }

      const coords = editor.getScrolledVisiblePosition({
        lineNumber: selection.startLineNumber,
        column: selection.startColumn,
      });
      const editorRect = editor.getDomNode()?.getBoundingClientRect();

      return {
        text: selectedText,
        path: propsRef.current.activeFile,
        range: {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        },
        anchor: coords && editorRect
          ? {
              x: editorRect.left + coords.left,
              y: editorRect.top + coords.top + coords.height,
            }
          : null,
      };
    };

    editor.addAction({
      id: "run-selection-in-new-terminal",
      label: "Run In New Terminal",
      contextMenuGroupId: "2_execution",
      contextMenuOrder: 1,
      precondition: "editorHasSelection",
      run: () => {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (!model || !selection || selection.isEmpty()) {
          return;
        }

        const selectedText = model.getValueInRange(selection);
        if (!selectedText || !selectedText.trim()) {
          return;
        }

        propsRef.current.onRunSelectionInNewTerminal?.({
          text: selectedText,
          path: propsRef.current.activeFile,
          range: {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn,
          },
        });
      },
    });

    editor.addAction({
      id: "inline-ai-edit-selection",
      label: "Inline AI Edit Selection",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 2,
      precondition: "editorHasSelection",
      run: () => {
        const payload = getCurrentSelectionPayload();
        if (!payload) return;
        propsRef.current.onInlineAiEditRequest?.(payload);
      },
    });

    editor.onDidBlurEditorWidget(() => {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;

      currentLineRef.current = null;
      lastValidPositionRef.current = null;

      useCollaborationStore
        .getState()
        .broadcastLineLock(
          currentUser.id,
          propsRef.current.activeFile,
          null,
          currentUser.user_metadata?.display_name ||
          currentUser.email?.split("@")[0] ||
          "Anonymous",
        );
    });

    editor.onDidChangeModelContent((event) => {
      if (isRemoteRef.current) {
        return;
      }

      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;

      // Check if any change touches a locked line — if so, undo immediately
      const touchesLockedLine = event.changes.some((change) => {
        for (let line = change.range.startLineNumber; line <= change.range.endLineNumber; line++) {
          if (isLineLockedForUser(line)) return true;
        }
        return false;
      });

      if (touchesLockedLine) {
        // Undo the edit that touched a locked line
        isRemoteRef.current = true;
        editor.trigger('locked-line-guard', 'undo', null);
        requestAnimationFrame(() => {
          isRemoteRef.current = false;
        });
        return;
      }

      const { activeFile, onContentChange } = propsRef.current;

      const serializedChanges = event.changes.map((change) => ({
        rangeOffset: change.rangeOffset,
        rangeLength: change.rangeLength,
        text: change.text,
        range: {
          startLineNumber: change.range.startLineNumber,
          startColumn: change.range.startColumn,
          endLineNumber: change.range.endLineNumber,
          endColumn: change.range.endColumn,
        },
      }));

      useCollaborationStore
        .getState()
        .broadcastChanges(currentUser.id, activeFile, serializedChanges);

      const isBulkEdit = event.changes.some(
        (c) => c.range.startLineNumber === 1 && c.range.startColumn === 1 && c.rangeLength > 20
      );
      if (isBulkEdit) {
        useCollaborationStore
          .getState()
          .broadcastFullSync(currentUser.id, activeFile, editor.getValue());
      }

      if (onContentChange) {
        onContentChange(event.changes, editor.getValue());
      }
    });

    editor.focus();
  };

  const syncModelsWithFileSystem = useCallback(
    (monacoInst) => {
      if (!monacoInst || !fileSystem) return;
      const currentModels = modelsRef.current;
      const fsPaths = Object.keys(fileSystem).filter(
        (p) => fileSystem[p].type === "file",
      );

      fsPaths.forEach((path) => {
        if (!currentModels[path]) {
          const uri = monacoInst.Uri.file(path);
          let model = monacoInst.editor.getModel(uri);
          if (!model) {
            // Monaco will auto-detect language based on extension in URI
            model = monacoInst.editor.createModel(
              fileSystem[path].content || "",
              undefined,
              uri,
            );
          }
          currentModels[path] = model;
        }
      });

      // Cleanup deleted files
      Object.keys(currentModels).forEach((path) => {
        if (!fileSystem[path]) {
          currentModels[path].dispose();
          delete currentModels[path];
        }
      });
    },
    [fileSystem],
  );

  useEffect(() => {
    if (monacoRef.current) {
      syncModelsWithFileSystem(monacoRef.current);
    }
  }, [fileSystem, syncModelsWithFileSystem]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && activeFile && modelsRef.current[activeFile]) {
      if (editor.getModel() !== modelsRef.current[activeFile]) {
        editor.setModel(modelsRef.current[activeFile]);
        editor.focus();
      }
    }
  }, [activeFile]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && activeFile && modelsRef.current[activeFile]) {
      updateRemoteCursors();
      updateLockDecorations();
      updateCursorNameOverlays();
    }
  }, [
    activeFile,
    updateRemoteCursors,
    updateLockDecorations,
    updateCursorNameOverlays,
  ]);

  useEffect(() => {
    useCollaborationStore.getState().setOnFullSync((content, senderId, path) => {
      const monaco = monacoRef.current;
      if (!monaco) return;

      const targetModel = modelsRef.current[path];
      if (!targetModel) return;

      if (targetModel.getValue() !== content) {
        isRemoteRef.current = true;
        try {
          const fullRange = targetModel.getFullModelRange();
          targetModel.applyEdits([{
            range: fullRange,
            text: content
          }]);

          const { onContentChange, activeFile: currentActive } = propsRef.current;
          if (path === currentActive && onContentChange) {
            onContentChange([], content);
          }
        } catch (err) {
          console.error("Failed to apply full sync:", err);
        } finally {
          requestAnimationFrame(() => {
            isRemoteRef.current = false;
          });
        }
      }
    });

    useCollaborationStore.getState().setOnCodeChanges((changes, senderId, path) => {
      const monaco = monacoRef.current;
      if (!monaco) return;

      const targetModel = modelsRef.current[path];
      if (!targetModel) return;

      // Guard: mark as remote so onDidChangeModelContent won't re-broadcast
      isRemoteRef.current = true;

      try {
        const edits = changes.map((change) => {
          const safeStartLine = Math.min(
            Math.max(change.range.startLineNumber, 1),
            targetModel.getLineCount(),
          );
          const safeEndLine = Math.min(
            Math.max(change.range.endLineNumber, 1),
            targetModel.getLineCount(),
          );
          const safeStartCol = Math.min(
            Math.max(change.range.startColumn, 1),
            targetModel.getLineMaxColumn(safeStartLine),
          );
          const safeEndCol = Math.min(
            Math.max(change.range.endColumn, 1),
            targetModel.getLineMaxColumn(safeEndLine),
          );

          return {
            range: new monaco.Range(
              safeStartLine,
              safeStartCol,
              safeEndLine,
              safeEndCol,
            ),
            text: change.text,
          };
        });

        // applyEdits modifies the model without undo-stack side-effects
        targetModel.applyEdits(edits);

        // Keep fileSystem React state in sync for the edited file
        const { onContentChange, activeFile: currentActive } = propsRef.current;
        if (path === currentActive && onContentChange) {
          onContentChange([], targetModel.getValue());
        }
      } catch (err) {
        console.error("Failed to apply remote edits:", err);
      } finally {
        // Reset flag after the synchronous event handlers have fired
        requestAnimationFrame(() => {
          isRemoteRef.current = false;
        });
      }
    });
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !navigationTarget) return;

    const { path, line, column, length } = navigationTarget;

    if (activeFile === path) {
      requestAnimationFrame(() => {
        editor.revealLineInCenter(line);
        editor.setPosition({
          lineNumber: line,
          column: column
        });

        searchDecorationRef.current = editor.deltaDecorations(
          searchDecorationRef.current,
          [{
            range: new monaco.Range(
              line,
              column,
              line,
              column + length
            ),
            options: {
              className: 'search-match-highlight',
              isWholeLine: false,
            }
          }]
        );

        setTimeout(() => {
          if (editorRef.current) {
            searchDecorationRef.current = editorRef.current.deltaDecorations(searchDecorationRef.current, []);
          }
        }, 1500);
      });
    }
  }, [navigationTarget, activeFile]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="session-code-editor"
      className="relative w-full h-full"
    >
      <Editor
        height="100%"
        theme="vs-dark"
        onMount={handleEditorDidMount}
        loading={
          <div className="flex items-center justify-center h-full bg-[#0d1117]">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-lg font-extralight text-dark-400">
                Loading editor...
              </span>
            </div>
          </div>
        }
        options={{
          readOnly,
          fontFamily: "JetBrains Mono, Fira Code, monospace",
          fontLigatures: true,
          fontSize: 14,
          lineHeight: 22,
          letterSpacing: 0.5,
          minimap: {
            enabled: true,
            maxColumn: 80,
            renderCharacters: false,
            showSlider: "mouseover",
          },
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: true,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          cursorWidth: 2,
          renderLineHighlight: "all",
          wordWrap: "off",
          bracketPairColorization: { enabled: true },
          automaticLayout: true,
          renderWhitespace: "selection",
          guides: {
            indentation: true,
            bracketPairs: true,
            highlightActiveBracketPair: true,
          },
          colorDecorators: true,
          suggest: {
            showIcons: true,
            preview: true,
          },
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          contextmenu: true,
          mouseWheelZoom: true,
          stickyScroll: { enabled: true },
          folding: true,
          foldingStrategy: "indentation",
          showFoldingControls: "mouseover",
          lineNumbers: "on",
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          glyphMargin: true,
        }}
      />
    </div>
  );
});

export default CodeEditor;
