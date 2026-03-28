import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FileCode,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Upload,
  Download,
} from 'lucide-react';

function getFileName(path) {
  return path.split('/').pop() || '';
}

function getParentPath(path) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

function buildTree(fileSystem) {
  const root = { name: '', path: '/', type: 'directory', children: [], expanded: true };
  
  // Sort paths to ensure consistent ordering (directories first, then alphabetically)
  const paths = Object.keys(fileSystem).sort((a, b) => {
    const aType = fileSystem[a].type;
    const bType = fileSystem[b].type;
    if (aType !== bType) return aType === 'directory' ? -1 : 1;
    return a.localeCompare(b);
  });

  const nodeMap = { '/': root };

  paths.forEach(path => {
    if (path === '/') return;
    const item = fileSystem[path];
    const parentPath = getParentPath(path);
    
    // Ensure parent exists in our transient tree
    if (!nodeMap[parentPath]) {
       nodeMap[parentPath] = { name: getFileName(parentPath), path: parentPath, type: 'directory', children: [] };
    }
    
    const node = {
      name: getFileName(path),
      path,
      type: item.type,
      children: [],
    };
    nodeMap[path] = node;
    nodeMap[parentPath].children.push(node);
  });

  return root;
}

const InlineInput = ({ defaultValue = "", type = "file", onSubmit, onCancel }) => {
  const [val, setVal] = useState(defaultValue);
  const inputRef = React.useRef(null);
  
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (defaultValue) {
        // Select the name without the extension if possible
        const dotIndex = defaultValue.lastIndexOf(".");
        if (dotIndex > 0) inputRef.current.setSelectionRange(0, dotIndex);
        else inputRef.current.select();
      }
    }
  }, [defaultValue]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (val.trim()) onSubmit(val.trim());
      else onCancel();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleBlur = () => {
    if (val.trim() && val.trim() !== defaultValue) onSubmit(val.trim());
    else onCancel();
  };

  return (
    <div className="flex items-center gap-1.5 overflow-hidden w-full h-full">
      <div className="w-3.5 shrink-0" />
      {type === "directory" ? (
        <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" />
      ) : (
        <FileCode className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
      )}
      <input
        ref={inputRef}
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="flex-1 bg-neutral-900 border border-accent-500/50 outline-none text-xs text-white px-1 py-0.5 ml-0.5 rounded focus:ring-1 focus:ring-accent-500/50 transition-all font-mono"
        autoComplete="off"
        spellCheck="false"
      />
    </div>
  );
};

const FileTreeNode = ({ 
  node, 
  level, 
  activeFile, 
  expandedFolders, 
  toggleFolder,
  creatingNode,
  renamingNode,
  deletingNode,
  setCreatingNode,
  setRenamingNode,
  setDeletingNode,
  dragTarget,
  setDragTarget,
  onSelectFile,
  onMove,
  onRename,
  onDelete,
  onCreate
}) => {
  const handleDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.type === 'directory') {
      if (dragTarget !== node.path) {
        setDragTarget(node.path);
      }
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if we are leaving the current dragTarget.
    // However, event bubbling and child entering clears it immediately,
    // so we rely mostly on drop or dragEnd to clean it securely,
    // but dragLeave is fine to attempt clearing.
    if (dragTarget === node.path) {
      setDragTarget(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(null);
    
    if (node.type === 'directory') {
      const draggedPath = e.dataTransfer.getData('text/plain');
      if (draggedPath && draggedPath !== node.path && !node.path.startsWith(draggedPath + '/')) {
        onMove(draggedPath, node.path === '/' ? '' : node.path);
      }
    }
  };

  const isExpanded = expandedFolders.has(node.path) || node.path === '/';
  const isActive = activeFile === node.path;
  const paddingLeft = level * 12 + 8;
  const isRenaming = renamingNode === node.path;
  const isDeleting = deletingNode === node.path;
  const isDragOver = dragTarget === node.path;

  // Root node is virtually hidden, its children are rendered
  if (node.path === '/') {
    return (
      <div 
        onDragOver={handleDragOver} 
        onDragLeave={handleDragLeave} 
        onDrop={handleDrop}
        className={`w-full h-full min-h-[50px] ${isDragOver ? 'bg-accent-500/10' : ''}`}
      >
        {creatingNode?.parentPath === '/' && (
           <div style={{ paddingLeft: '8px' }} className="flex items-center py-1 px-2 border-y border-transparent">
              <InlineInput 
                 type={creatingNode.type}
                 onSubmit={(name) => {
                    onCreate('/', name, creatingNode.type);
                    setCreatingNode(null);
                 }}
                 onCancel={() => setCreatingNode(null)}
              />
           </div>
        )}
        {node.children.map(child => (
          <FileTreeNode 
            key={child.path} 
            node={child} 
            level={0} 
            activeFile={activeFile}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            creatingNode={creatingNode}
            renamingNode={renamingNode}
            deletingNode={deletingNode}
            setCreatingNode={setCreatingNode}
            setRenamingNode={setRenamingNode}
            setDeletingNode={setDeletingNode}
            dragTarget={dragTarget}
            setDragTarget={setDragTarget}
            onSelectFile={onSelectFile}
            onMove={onMove}
            onRename={onRename}
            onDelete={onDelete}
            onCreate={onCreate}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        draggable={!isRenaming && !isDeleting}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (isRenaming || isDeleting) return;
          if (node.type === 'directory') toggleFolder(node.path);
          else onSelectFile(node.path);
        }}
        className={`group flex items-center justify-between py-1 px-2 cursor-pointer text-xs select-none border-y border-transparent transition-colors ${
          isActive && !isRenaming && !isDeleting ? 'bg-accent-500/10 text-accent-400 border-y-accent-500/20' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
        } ${isDragOver ? 'bg-accent-500/20 border-accent-500/50' : ''}`}
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        {isRenaming ? (
          <InlineInput 
            defaultValue={node.name}
            type={node.type}
            onSubmit={(newName) => {
              onRename(node.path, newName);
              setRenamingNode(null);
            }}
            onCancel={() => setRenamingNode(null)}
          />
        ) : isDeleting ? (
          <div className="flex items-center justify-between w-full text-red-400 pr-1">
            <span className="truncate flex-1 font-medium">Delete {node.name}?</span>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(node.path); setDeletingNode(null); }}
                className="p-1 hover:bg-red-500/20 rounded text-red-500 transition-colors"
                title="Confirm"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setDeletingNode(null); }}
                className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white transition-colors"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 overflow-hidden">
              {node.type === 'directory' ? (
                isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <div className="w-3.5 shrink-0" /> /* spacer for files */
              )}
              
              {node.type === 'directory' ? (
                isExpanded ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-accent-400" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              ) : (
                <FileCode className="w-3.5 h-3.5 shrink-0" />
              )}
              
              <span className="truncate">{node.name}</span>
            </div>

            {/* Action icons (shown on hover) */}
            <div className="hidden group-hover:flex items-center gap-1 shrink-0 px-1">
              <button 
                onClick={(e) => { e.stopPropagation(); setRenamingNode(node.path); }}
                className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white"
                title="Rename"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setDeletingNode(node.path); }}
                className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {node.type === 'directory' && isExpanded && (
        <div>
          {creatingNode?.parentPath === node.path && (
             <div style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }} className="flex items-center py-1 px-2 border-y border-transparent">
                <InlineInput 
                   type={creatingNode.type}
                   onSubmit={(name) => {
                      onCreate(node.path, name, creatingNode.type);
                      setCreatingNode(null);
                   }}
                   onCancel={() => setCreatingNode(null)}
                />
             </div>
          )}
          {node.children.map(child => (
            <FileTreeNode 
              key={child.path} 
              node={child} 
              level={level + 1} 
              activeFile={activeFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              creatingNode={creatingNode}
              renamingNode={renamingNode}
              deletingNode={deletingNode}
              setCreatingNode={setCreatingNode}
              setRenamingNode={setRenamingNode}
              setDeletingNode={setDeletingNode}
              dragTarget={dragTarget}
              setDragTarget={setDragTarget}
              onSelectFile={onSelectFile}
              onMove={onMove}
              onRename={onRename}
              onDelete={onDelete}
              onCreate={onCreate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FileTree({ 
  fileSystem, 
  activeFile, 
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onMove,
  onRename,
  onDelete,
  onRequestUpload,
  onRequestDownload,
  onUploadDrop,
}) {
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [creatingNode, setCreatingNode] = useState(null);
  const [renamingNode, setRenamingNode] = useState(null);
  const [deletingNode, setDeletingNode] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const [isDropzoneActive, setIsDropzoneActive] = useState(false);

  const tree = useMemo(() => buildTree(fileSystem || {}), [fileSystem]);

  const toggleFolder = (path) => {
    const next = new Set(expandedFolders);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpandedFolders(next);
  };
  
  const handleStartCreate = (type) => {
     let parentPath = '/';
     if (activeFile) {
        parentPath = getParentPath(activeFile);
     }
     if (parentPath !== '/') {
        setExpandedFolders(prev => new Set([...prev, parentPath]));
     }
     setCreatingNode({ type, parentPath });
  };

  const handleCommitCreate = (parentPath, name, type) => {
    if (type === 'file') onCreateFile(parentPath, name);
    else onCreateFolder(parentPath, name);
  };

  const hasExternalFiles = (event) => {
    const dt = event.dataTransfer;
    if (!dt) return false;

    const types = Array.from(dt.types || []);
    const hasKnownFileType =
      types.includes('Files') ||
      types.includes('application/x-moz-file') ||
      types.includes('public.file-url');

    if (hasKnownFileType) return true;

    if ((dt.files?.length || 0) > 0) return true;

    const items = Array.from(dt.items || []);
    return items.some((item) => item.kind === 'file');
  };

  const handleDragOverCapture = (event) => {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDropzoneActive) setIsDropzoneActive(true);
  };

  const handleDragLeaveCapture = (event) => {
    if (!hasExternalFiles(event)) return;
    const next = event.relatedTarget;
    if (event.currentTarget.contains(next)) return;
    setIsDropzoneActive(false);
  };

  const handleDropCapture = (event) => {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    setIsDropzoneActive(false);
    onUploadDrop?.(event);
  };

  return (
    <div
      className="relative flex flex-col h-full bg-[#121215]"
      onDragOverCapture={handleDragOverCapture}
      onDragLeaveCapture={handleDragLeaveCapture}
      onDropCapture={handleDropCapture}
    >
      {/* Action Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Explorer</span>
        <div className="flex items-center gap-1">
          <button 
            onClick={onRequestUpload}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
            title="Upload"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onRequestDownload}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
            title="Download Session (.zip)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleStartCreate("file")}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
            title="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleStartCreate("directory")}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
            title="New Folder"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto py-2">
        {Object.keys(fileSystem || {}).length === 0 ? (
          <div className="text-xs text-neutral-500 text-center mt-4">No files</div>
        ) : (
          <FileTreeNode 
            node={tree} 
            level={0} 
            activeFile={activeFile}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            creatingNode={creatingNode}
            renamingNode={renamingNode}
            deletingNode={deletingNode}
            setCreatingNode={setCreatingNode}
            setRenamingNode={setRenamingNode}
            setDeletingNode={setDeletingNode}
            dragTarget={dragTarget}
            setDragTarget={setDragTarget}
            onSelectFile={onSelectFile}
            onMove={onMove}
            onRename={onRename}
            onDelete={onDelete}
            onCreate={handleCommitCreate}
          />
        )}
      </div>

      {isDropzoneActive && (
        <div className="absolute inset-0 m-2 rounded-lg border-2 border-dashed border-accent-500/70 bg-accent-500/10 flex items-center justify-center pointer-events-none">
          <div className="text-center px-4">
            <p className="text-sm font-semibold text-accent-300">Drop files or folders to upload</p>
            <p className="text-xs text-neutral-300 mt-1">Your folder tree will be preserved.</p>
          </div>
        </div>
      )}
    </div>
  );
}
