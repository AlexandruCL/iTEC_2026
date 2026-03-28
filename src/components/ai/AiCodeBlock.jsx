import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, X, Copy, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

const STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  DISMISSED: "dismissed",
};

export default function AiCodeBlock({ code, language, onAccept, onDismiss }) {
  const [status, setStatus] = useState(STATUS.PENDING);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const lines = code.split("\n");
  const isLong = lines.length > 12;
  const displayCode = expanded || !isLong ? code : lines.slice(0, 12).join("\n") + "\n…";

  const handleAccept = () => {
    setStatus(STATUS.ACCEPTED);
    onAccept?.(code);
  };

  const handleDismiss = () => {
    setStatus(STATUS.DISMISSED);
    onDismiss?.();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (status === STATUS.DISMISSED) {
    return (
      <motion.div
        initial={{ opacity: 1, height: "auto" }}
        animate={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="my-2 rounded-lg border border-neutral-800/50 bg-neutral-900/30 px-3 py-2 text-xs text-neutral-600 italic">
          Suggestion dismissed
        </div>
      </motion.div>
    );
  }

  if (status === STATUS.ACCEPTED) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        className="my-2"
      >
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">
            Code inserted at cursor
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="my-3 group"
    >
      <div className="rounded-xl border border-accent-500/30 bg-gradient-to-b from-accent-500/[0.04] to-neutral-900/80 backdrop-blur-sm overflow-hidden shadow-lg shadow-accent-500/5">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/60 bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-accent-500/15 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-accent-400" />
            </div>
            <span className="text-[10px] font-semibold text-accent-400 uppercase tracking-wider">
              AI Suggestion
            </span>
            {language && (
              <>
                <span className="text-neutral-700">·</span>
                <span className="text-[10px] font-mono text-neutral-500 uppercase">
                  {language}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-neutral-800 transition-colors"
              title="Copy code"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-neutral-500 hover:text-neutral-300" />
              )}
            </button>
          </div>
        </div>

        {/* Code Preview */}
        <div className="relative">
          <pre className="px-3 py-3 text-[12.5px] leading-[1.6] font-mono text-neutral-200 overflow-x-auto max-h-[320px] overflow-y-auto scrollbar-thin">
            <code>{displayCode}</code>
          </pre>

          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 bg-neutral-900/80 border-t border-neutral-800/50 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Show all {lines.length} lines
                </>
              )}
            </button>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-neutral-800/60 bg-neutral-950/40">
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 text-xs font-medium transition-all duration-150"
          >
            <Check className="w-3.5 h-3.5" />
            Accept
          </button>

          <button
            onClick={handleDismiss}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 hover:border-red-500/30 text-red-400 text-xs font-medium transition-all duration-150"
          >
            <X className="w-3.5 h-3.5" />
            Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  );
}
