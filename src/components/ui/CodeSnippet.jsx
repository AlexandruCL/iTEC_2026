import React from "react";
import { cn } from "@/lib/utils";

export default function CodeSnippet({ filename = "main.js", children, className }) {
  return (
    <div className={cn("code-block overflow-hidden", className)}>
      {/* Window chrome */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
        </div>
        <span className="text-xs text-neutral-500 font-mono">{filename}</span>
        <div className="w-16" />
      </div>
      {/* Code content */}
      <div className="p-5 overflow-x-auto">
        <pre className="text-[13px] leading-7">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  );
}

/* Helper spans for syntax coloring */
export function Keyword({ children }) {
  return <span className="text-purple-400">{children}</span>;
}

export function Str({ children }) {
  return <span className="text-accent-400">{children}</span>;
}

export function Func({ children }) {
  return <span className="text-blue-400">{children}</span>;
}

export function Comment({ children }) {
  return <span className="text-neutral-500 italic">{children}</span>;
}

export function Var({ children }) {
  return <span className="text-amber-300">{children}</span>;
}

export function Punct({ children }) {
  return <span className="text-neutral-400">{children}</span>;
}
