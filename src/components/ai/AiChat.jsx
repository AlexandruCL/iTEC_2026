import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Sparkles, X, Loader2, Bot, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

const SYSTEM_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const DEFAULT_MODEL = "gemini-2.5-flash";

export default function AiChat({ isOpen, onClose, code, onApplyCode }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI coding assistant powered by Gemini. How can I help you with your code today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { aiConfig, isAiConfigExpired, resetAiConfig } = useAuthStore();

  // Auto-clear expired custom config
  const expired = aiConfig.useCustom && isAiConfigExpired();
  if (expired) {
    resetAiConfig();
  }

  const effectiveKey =
    !expired && aiConfig.useCustom && aiConfig.apiKey
      ? aiConfig.apiKey
      : SYSTEM_GEMINI_KEY;
  const effectiveModel =
    !expired && aiConfig.useCustom && aiConfig.model
      ? aiConfig.model
      : DEFAULT_MODEL;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      if (!effectiveKey) {
        throw new Error(
          "No API key available. The platform key is missing and no custom key is configured."
        );
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${effectiveKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are an expert coding assistant. The user is working on the following code:\n\n\`\`\`\n${code}\n\`\`\`\n\nUser question: ${userMessage}\n\nProvide helpful, concise answers. If suggesting code changes, wrap them in code blocks with the appropriate language tag.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        const detail = errBody?.error?.message || `HTTP ${response.status}`;
        throw new Error(`Gemini API error: ${detail}`);
      }

      const data = await response.json();
      const aiResponse =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I could not generate a response.";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiResponse },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${error.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Simple markdown-like rendering for code blocks
  const renderContent = (content) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0].trim();
        const code = lines.slice(lang ? 1 : 0).join("\n");
        return (
          <div key={i} className="my-2 rounded-lg overflow-hidden border border-neutral-800">
            {lang && (
              <div className="px-3 py-1 bg-neutral-800/50 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                {lang}
              </div>
            )}
            <pre className="px-3 py-2 bg-neutral-900/80 text-[13px] leading-5 font-mono text-neutral-200 overflow-x-auto">
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  };

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "26rem", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="h-full bg-neutral-950 border-l border-neutral-800 flex-shrink-0 z-40 overflow-hidden relative shadow-black/20"
        >
          {/* Inner fixed-width container prevents content from squishing during slide animation */}
          <div className="w-[26rem] h-full flex flex-col absolute inset-y-0 left-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-[3.5rem] min-h-[3.5rem] border-b border-neutral-800 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-500/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-accent-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white font-display">
                    AI Assistant
                  </span>
                  <span className="ml-2 text-[10px] text-neutral-500 font-mono uppercase">
                    {effectiveModel}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-neutral-800 transition-colors"
                title="Close AI Assistant"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-2.5 ${
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
                      message.role === "user"
                        ? "bg-accent-500/15"
                        : "bg-neutral-800"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User className="w-3.5 h-3.5 text-accent-400" />
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-neutral-400" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      message.role === "user"
                        ? "bg-accent-500 text-white"
                        : "bg-neutral-900 border border-neutral-800 text-neutral-200"
                    }`}
                  >
                    {message.role === "assistant"
                      ? renderContent(message.content)
                      : message.content}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2.5"
                >
                  <div className="w-7 h-7 rounded-full bg-neutral-800 flex-shrink-0 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-accent-400" />
                    <span className="text-xs text-neutral-500">Thinking...</span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-neutral-800 flex-shrink-0 bg-neutral-950">
              {!effectiveKey && (
                <p className="mb-2 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
                  No API key configured. Add one in Settings → AI Configuration.
                </p>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your code..."
                  className="flex-1 w-0 px-3.5 py-2.5 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors font-mono"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="px-3.5 py-2.5 bg-accent-500 hover:bg-accent-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors flex-shrink-0 shadow-sm shadow-accent-500/20"
                  title="Send message"
                >
                  <Send className="w-4 h-4 text-neutral-950" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
