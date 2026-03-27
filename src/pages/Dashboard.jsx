import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Code2, Trash2, Users, Clock, Database } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useSessionStore } from "@/stores/sessionStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import FadeIn from "@/components/ui/FadeIn";
import { formatDate } from "@/lib/utils";
import toast, { Toaster } from "react-hot-toast";

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
];

export default function Dashboard() {
  const { user } = useAuthStore();
  const { sessions, loading, fetchSessions, createSession, deleteSession, maxSessions } = useSessionStore();
  const navigate = useNavigate();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionLanguage, setSessionLanguage] = useState("javascript");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      fetchSessions(user.id).catch(() => {});
    }
  }, [user, fetchSessions]);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionName.trim()) {
      toast.error("Please enter a session name");
      return;
    }
    if (!isSupabaseConfigured()) {
      toast.error("Please connect Supabase to create sessions");
      return;
    }

    setIsCreating(true);
    try {
      const session = await createSession(user.id, sessionName.trim(), sessionLanguage);
      toast.success("Session created!");
      setIsCreateModalOpen(false);
      setSessionName("");
      navigate(`/session/${session.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (!isSupabaseConfigured()) {
      toast.error("Please connect Supabase");
      return;
    }
    try {
      await deleteSession(sessionId);
      toast.success("Session deleted");
    } catch (error) {
      toast.error("Failed to delete session");
    }
  };

  return (
    <div id="dashboard-page" className="min-h-screen bg-neutral-950 flex flex-col">
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
      <Header />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <h1 className="text-3xl font-bold text-white mb-1 font-display tracking-tight">
                  Welcome back{user?.user_metadata?.display_name ? `, ${user.user_metadata.display_name}` : ""}
                </h1>
                <p className="text-sm text-neutral-500">
                  {sessions.length} of {maxSessions} sessions used
                </p>
              </div>
              <Button
                icon={Plus}
                onClick={() => setIsCreateModalOpen(true)}
                disabled={sessions.length >= maxSessions}
              >
                New Session
              </Button>
            </div>
          </FadeIn>

          {!isSupabaseConfigured() && (
            <FadeIn delay={0.1}>
              <Card hover={false} className="mb-8 border-amber-500/20 bg-amber-500/5">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Database className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1 font-display">Connect Supabase</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                      To create and manage coding sessions, connect a Supabase project via your IDE.
                    </p>
                  </div>
                </div>
              </Card>
            </FadeIn>
          )}

          {sessions.length === 0 && isSupabaseConfigured() && !loading ? (
            <FadeIn delay={0.1}>
              <Card hover={false} className="text-center py-16 border-dashed border-2 border-neutral-800 bg-transparent">
                <Code2 className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2 font-display">No sessions yet</h3>
                <p className="text-sm text-neutral-500 mb-6">
                  Create your first session and start collaborating.
                </p>
                <Button icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
                  Create Session
                </Button>
              </Card>
            </FadeIn>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {sessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                  >
                    <Card
                      className="cursor-pointer h-full flex flex-col group"
                      onClick={() => navigate(`/session/${session.id}`)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-center justify-center">
                            <Code2 className="w-4 h-4 text-accent-400" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white font-display group-hover:text-accent-400 transition-colors">
                              {session.name}
                            </h3>
                            <span className="text-xs text-neutral-500 uppercase tracking-wider">
                              {session.language}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-1" />

                      <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
                        <div className="flex items-center gap-2 text-neutral-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs">
                            {formatDate(session.updated_at || session.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-neutral-500">
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">
                            {session.collaborators?.length || 0}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New Session"
      >
        <form onSubmit={handleCreateSession} className="space-y-5" noValidate>
          <Input
            label="Session Name"
            placeholder="e.g. sprint-backend"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            autoFocus
          />
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2 font-display">
              Language
            </label>
            <select
              value={sessionLanguage}
              onChange={(e) => setSessionLanguage(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500/30 appearance-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value} className="bg-neutral-900">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isCreating}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
