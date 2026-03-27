import React, { useState } from "react";
import { motion } from "motion/react";
import { Key, Save, User, Palette, Pencil, Check, X, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useCollaborationStore } from "@/stores/collaborationStore";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import toast, { Toaster } from "react-hot-toast";

const CURSOR_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e"
];

export default function Settings() {
  const { user, geminiApiKey, setGeminiApiKey, updateDisplayName } = useAuthStore();
  const { userColor } = useCollaborationStore();
  const [apiKey, setApiKey] = useState(geminiApiKey || "");
  const [selectedColor, setSelectedColor] = useState(userColor);
  const [saving, setSaving] = useState(false);

  const currentDisplayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [updatingName, setUpdatingName] = useState(false);

  const handleSaveApiKey = () => {
    setSaving(true);
    setGeminiApiKey(apiKey);
    setTimeout(() => {
      setSaving(false);
      toast.success("API key saved!");
    }, 500);
  };

  const handleUpdateDisplayName = async () => {
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty");
      return;
    }

    if (displayName.trim() === currentDisplayName) {
      toast("No changes to save", { icon: "💡" });
      return;
    }

    setUpdatingName(true);
    try {
      await updateDisplayName(displayName);
      toast.success("Display name updated!");
    } catch (error) {
      toast.error(error.message || "Failed to update display name");
    } finally {
      setUpdatingName(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleUpdateDisplayName();
    }
  };

  const hasNameChanged = displayName.trim() !== currentDisplayName;

  return (
    <div id="settings-page" className="min-h-screen bg-dark-950">
      <Toaster position="top-center" />
      <Header />

      <main className="pt-24 pb-12">
        <div className="max-w-[2400px] mx-auto">
          <div className="grid grid-cols-12">
            <div className="col-span-12 px-4 md:col-start-2 md:col-span-10 lg:col-start-3 lg:col-span-8">
              <h1 className="text-3xl font-light text-white mb-8">Settings</h1>

              <div className="space-y-6">
                <Card hover={false}>
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center">
                      <User className="w-5 h-5 text-dark-300" />
                    </div>
                    <div>
                      <h2 className="text-xl font-medium text-white">Profile</h2>
                      <p className="text-lg font-extralight text-dark-400">
                        Your account information
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-lg font-medium text-dark-200 mb-2">
                        Email
                      </label>
                      <p className="text-lg font-extralight text-white">{user?.email}</p>
                    </div>
                    <div>
                      <label className="block text-lg font-medium text-dark-200 mb-2">
                        Display Name
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter your display name"
                            maxLength={30}
                            className="w-full px-4 py-3 text-lg font-extralight bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                        <motion.div
                          initial={false}
                          animate={{ opacity: hasNameChanged ? 1 : 0.4 }}
                        >
                          <Button
                            icon={updatingName ? Loader2 : Check}
                            onClick={handleUpdateDisplayName}
                            loading={updatingName}
                            disabled={!hasNameChanged || updatingName}
                            size="md"
                          >
                            Update
                          </Button>
                        </motion.div>
                      </div>
                      <p className="text-lg font-extralight text-dark-500 mt-2">
                        {displayName.trim().length}/30 characters
                      </p>
                    </div>
                  </div>
                </Card>

                <Card hover={false}>
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Key className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-medium text-white">Gemini API Key</h2>
                      <p className="text-lg font-extralight text-dark-400">
                        Add your own API key for AI assistance (optional)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Input
                      type="password"
                      placeholder="Enter your Gemini API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <p className="text-lg font-extralight text-dark-500">
                      Get your API key from{" "}
                      <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-400 hover:text-primary-300"
                      >
                        Google AI Studio
                      </a>
                    </p>
                    <Button
                      icon={Save}
                      onClick={handleSaveApiKey}
                      loading={saving}
                    >
                      Save API Key
                    </Button>
                  </div>
                </Card>

                <Card hover={false}>
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                      <Palette className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-medium text-white">Cursor Color</h2>
                      <p className="text-lg font-extralight text-dark-400">
                        Choose your cursor color for collaboration
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {CURSOR_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-10 h-10 rounded-lg transition-transform ${
                          selectedColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-dark-800 scale-110" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
