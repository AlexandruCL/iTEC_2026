import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, FileCode, ChevronDown, ChevronRight, X } from "lucide-react";

export default function SearchPanel({ fileSystem, onResultClick, autoFocus = false }) {
  const [query, setQuery] = useState("");
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const searchResults = useMemo(() => {
    if (!query) return [];

    const hits = [];
    let count = 0;
    const lowerQuery = query.toLowerCase();

    for (const [path, node] of Object.entries(fileSystem || {})) {
      if (node.type === "file" && node.content && typeof node.content === "string") {
        const lines = node.content.split("\n");
        const fileHits = [];

        for (let i = 0; i < lines.length; i++) {
          if (count >= 1000) break;
          const lineStr = lines[i];
          const lowerLine = lineStr.toLowerCase();
          let index = lowerLine.indexOf(lowerQuery);

          while (index !== -1 && count < 1000) {
            fileHits.push({
              line: i + 1,
              column: index + 1,
              originalLine: lineStr,
              matchLength: query.length,
            });
            count++;
            index = lowerLine.indexOf(lowerQuery, index + query.length);
          }
        }

        if (fileHits.length > 0) {
          hits.push({ path, hits: fileHits });
        }
      }
    }
    return { hits, total: count };
  }, [query, fileSystem]);

  // Auto-expand all files when results change
  useEffect(() => {
    if (searchResults.hits.length > 0) {
      setExpandedFiles(new Set(searchResults.hits.map(h => h.path)));
    } else {
      setExpandedFiles(new Set());
    }
  }, [searchResults.hits]);

  const toggleExpand = (path) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const getFileName = (path) => path.split("/").pop() || "";

  // Highlight helper for rendering bolded text
  const HighlightedText = ({ text, matchWord, column }) => {
    if (!matchWord || !text || column <= 0) return <span>{text}</span>;
    const trimmedIndex = text.length - text.trimStart().length; // Find how many spaces we trimmed
    const trimmed = text.trim();
    
    // Adjust column to account for trimmed whitespace
    const startIndex = column - 1 - trimmedIndex;

    if (startIndex < 0 || startIndex >= trimmed.length) return <span>{trimmed}</span>;

    return (
      <span className="truncate flex-1">
        {trimmed.substring(0, startIndex)}
        <span className="bg-accent-500/30 text-accent-300 rounded font-medium">
            {trimmed.substring(startIndex, startIndex + matchWord.length)}
        </span>
        {trimmed.substring(startIndex + matchWord.length)}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#121215]">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 shrink-0">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Search</span>
      </div>

      <div className="p-3 shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-4 h-4 text-neutral-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-8 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/30 transition-all font-mono"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 p-0.5 rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {query && (
           <div className="text-[10px] text-neutral-500 mt-2 px-1">
             {searchResults.total >= 1000 
                ? "1000+ results found (capped)" 
                : `${searchResults.total} results in ${searchResults.hits.length} files`}
           </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar">
        {!query ? (
          <div className="text-xs text-neutral-600 text-center mt-4">Type to search</div>
        ) : searchResults.hits.length === 0 ? (
          <div className="text-xs text-neutral-500 text-center mt-4">No results found</div>
        ) : (
          <div className="flex flex-col">
            {searchResults.hits.map((fileGroup) => {
              const isExpanded = expandedFiles.has(fileGroup.path);
              const fileName = getFileName(fileGroup.path);

              return (
                <div key={fileGroup.path} className="flex flex-col">
                  {/* File Header */}
                  <div
                    onClick={() => toggleExpand(fileGroup.path)}
                    className="flex items-center gap-1.5 py-1 px-2 hover:bg-neutral-800/80 cursor-pointer text-xs text-neutral-300 select-none group border-l-2 border-transparent hover:border-l-accent-500/50 transition-colors"
                  >
                     <div className="opacity-60 group-hover:opacity-100 flex items-center justify-center shrink-0">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                     </div>
                     <FileCode className="w-3.5 h-3.5 text-accent-500 opacity-80 shrink-0" />
                     <span className="font-medium truncate flex-1">{fileName}</span>
                     <span className="text-[10px] bg-neutral-800 px-1.5 rounded-full text-neutral-400 group-hover:bg-neutral-700 transition-colors">
                        {fileGroup.hits.length}
                     </span>
                  </div>

                  {/* Matches */}
                  {isExpanded && fileGroup.hits.map((hit, idx) => (
                    <div
                      key={idx}
                      onClick={() => onResultClick(fileGroup.path, hit.line, hit.column, hit.matchLength)}
                      className="flex items-start gap-2 py-1 hover:bg-accent-500/10 cursor-pointer text-xs group border-l border-transparent hover:border-l-accent-500 transition-colors"
                      style={{ paddingLeft: "26px", paddingRight: "8px" }}
                    >
                      <span className="text-[10px] text-neutral-500 font-mono w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                         {hit.line}
                      </span>
                      <div className="text-neutral-400 font-code overflow-hidden flex-1">
                         <HighlightedText text={hit.originalLine} matchWord={query} column={hit.column} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
