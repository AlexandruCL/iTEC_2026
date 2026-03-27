import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Save, User, Palette, Check, Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useCollaborationStore } from "@/stores/collaborationStore";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import toast, { Toaster } from "react-hot-toast";

const CURSOR_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e"
];

export default function Settings() {
  const { user, aiConfig, setAiConfig, resetAiConfig, updateDisplayName } = useAuthStore();
  const { userColor } = useCollaborationStore();
  const [selectedColor, setSelectedColor] = useState(userColor);
  const [saving, setSaving] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // AI config local state (mirrors store, committed on save)
  const [useCustom, setUseCustom] = useState(aiConfig.useCustom || false);
  const [customApiKey, setCustomApiKey] = useState(aiConfig.apiKey || "");
  const [customModel, setCustomModel] = useState(aiConfig.model || "gemini-2.5-flash");

  const currentDisplayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [updatingName, setUpdatingName] = useState(false);

  const handleSaveAiConfig = () => {
    if (useCustom && !customApiKey.trim()) {
      toast.error("Please enter an API key or switch back to the default plan.");
      return;
    }
    // If switching to custom, show disclaimer first
    if (useCustom) {
      setShowDisclaimer(true);
      return;
    }
    // Switching to default — save immediately
    commitAiConfig();
  };

  const commitAiConfig = () => {
    setSaving(true);
    setAiConfig({
      useCustom,
      apiKey: customApiKey.trim(),
      model: customModel.trim() || "gemini-2.5-flash",
      savedAt: useCustom ? Date.now() : null,
    });
    setTimeout(() => {
      setSaving(false);
      toast.success(useCustom ? "Custom AI configuration saved!" : "Using default AI configuration.");
    }, 400);
  };

  const handleResetAiConfig = () => {
    resetAiConfig();
    setUseCustom(false);
    setCustomApiKey("");
    setCustomModel("gemini-2.5-flash");
    toast.success("Reset to default AI configuration.");
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
                {/* Profile Card */}
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

                {/* AI Configuration Card */}
                <Card hover={false}>
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-medium text-white">AI Assistant</h2>
                      <p className="text-lg font-extralight text-dark-400">
                        Configure the AI model powering your code assistant
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* Default plan badge */}
                    {!useCustom && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                      >
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-lg font-extralight text-emerald-300">
                          Using the free built-in Gemini AI assistant
                        </span>
                      </motion.div>
                    )}

                    {/* Toggle */}
                    <div className="flex items-center justify-between">
                      <label htmlFor="ai-custom-toggle" className="text-lg font-medium text-dark-200 cursor-pointer">
                        Use custom AI configuration
                      </label>
                      <button
                        id="ai-custom-toggle"
                        role="switch"
                        aria-checked={useCustom}
                        onClick={() => setUseCustom(!useCustom)}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                          useCustom ? "bg-purple-500" : "bg-dark-600"
                        }`}
                      >
                        <motion.div
                          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                          animate={{ x: useCustom ? 20 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>

                    {/* Custom config fields */}
                    <AnimatePresence>
                      {useCustom && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-4 pt-1">
                            <div>
                              <label className="block text-lg font-medium text-dark-200 mb-2">
                                API Key
                              </label>
                              <Input
                                type="password"
                                placeholder="Enter your Gemini API key"
                                value={customApiKey}
                                onChange={(e) => setCustomApiKey(e.target.value)}
                              />
                              <p className="text-lg font-extralight text-dark-500 mt-1.5">
                                Get a key from{" "}
                                <a
                                  href="https://aistudio.google.com/apikey"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-400 hover:text-primary-300 transition-colors"
                                >
                                  Google AI Studio
                                </a>
                              </p>
                            </div>

                            <div>
                              <label className="block text-lg font-medium text-dark-200 mb-2">
                                Model
                              </label>
                              <Input
                                type="text"
                                placeholder="gemini-2.5-flash"
                                value={customModel}
                                onChange={(e) => setCustomModel(e.target.value)}
                              />
                              <p className="text-lg font-extralight text-dark-500 mt-1.5">
                                The Gemini model to use (e.g. gemini-2.5-flash, gemini-1.5-pro)
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                      <Button
                        icon={Save}
                        onClick={handleSaveAiConfig}
                        loading={saving}
                      >
                        {useCustom ? "Save Configuration" : "Confirm Default"}
                      </Button>
                      {aiConfig.useCustom && (
                        <button
                          onClick={handleResetAiConfig}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors text-lg font-extralight"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reset to default
                        </button>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Cursor Color Card */}
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

      {/* Disclaimer Modal */}
      <Modal
        isOpen={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        title="Storage Disclaimer"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-lg font-extralight text-amber-200 leading-relaxed">
              Your API key will be stored <strong className="font-medium text-white">locally in your browser</strong> for a maximum of <strong className="font-medium text-white">30 days</strong>. It is never sent to our servers. After 30 days, the key will be automatically cleared and the assistant will revert to the default configuration.
            </p>
          </div>
          <p className="text-lg font-extralight text-dark-400">
            By confirming, you acknowledge that you are responsible for the security of your own API key.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Button
              icon={Check}
              onClick={() => {
                setShowDisclaimer(false);
                commitAiConfig();
              }}
            >
              I Understand, Save
            </Button>
            <button
              onClick={() => setShowDisclaimer(false)}
              className="px-4 py-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors text-lg font-extralight"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
