import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Code2, Trash2, Users, Clock, ExternalLink } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useSessionStore } from "@/stores/sessionStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
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
      fetchSessions(user.id).catch(() => {
        // Sessions table might not exist yet
      });
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

  const handleJoinSession = (sessionId) => {
    navigate(`/session/${sessionId}`);
  };

  return (
    <div id="dashboard-page" className="min-h-screen bg-dark-950">
      <Toaster position="top-center" />
      <Header />

      <main className="pt-24 pb-12">
        <div className="max-w-[2400px] mx-auto">
          <div className="grid grid-cols-12">
            <div className="col-span-12 px-4 md:col-start-2 md:col-span-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-3xl font-light text-white mb-2">
                    Welcome back, {user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Developer"}
                  </h1>
                  <p className="text-lg font-extralight text-dark-400">
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

              {!isSupabaseConfigured() && (
                <Card hover={false} className="mb-8 border-amber-500/30">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <Code2 className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-medium text-white mb-2">Connect Supabase</h3>
                      <p className="text-lg font-extralight text-dark-400">
                        To create and manage coding sessions, please connect a Supabase project. Click the "Connect to Supabase" button in your IDE to get started.
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {sessions.length === 0 && isSupabaseConfigured() && !loading ? (
                <Card hover={false} className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center mx-auto mb-6">
                    <Code2 className="w-8 h-8 text-dark-400" />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-2">No sessions yet</h3>
                  <p className="text-lg font-extralight text-dark-400 mb-6">
                    Create your first coding session and start collaborating
                  </p>
                  <Button icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
                    Create Session
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {sessions.map((session) => (
                      <motion.div
                        key={session.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <Card
                          className="cursor-pointer h-full flex flex-col"
                          onClick={() => handleJoinSession(session.id)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center">
                                <Code2 className="w-5 h-5 text-primary-400" />
                              </div>
                              <div>
                                <h3 className="text-lg font-medium text-white">{session.name}</h3>
                                <span className="text-lg font-extralight text-dark-400 capitalize">
                                  {session.language}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              className="p-2 rounded-lg hover:bg-red-500/20 text-dark-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex-1" />

                          <div className="flex items-center justify-between pt-4 border-t border-dark-700">
                            <div className="flex items-center gap-2 text-dark-400">
                              <Clock className="w-4 h-4" />
                              <span className="text-lg font-extralight">
                                {formatDate(session.updated_at || session.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-dark-400">
                              <Users className="w-4 h-4" />
                              <span className="text-lg font-extralight">
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
          </div>
        </div>
      </main>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Session"
      >
        <form onSubmit={handleCreateSession} className="space-y-4" noValidate>
          <Input
            label="Session Name"
            placeholder="My awesome project"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
          />
          <div>
            <label className="block text-lg font-medium text-dark-200 mb-2">
              Language
            </label>
            <select
              value={sessionLanguage}
              onChange={(e) => setSessionLanguage(e.target.value)}
              className="w-full px-4 py-3 text-lg bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
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
