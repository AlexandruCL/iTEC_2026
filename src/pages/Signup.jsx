import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Mail, Lock, User, Github, Code2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import toast, { Toaster } from "react-hot-toast";

export default function Signup() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUpWithEmail, signInWithGithub } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const handleEmailSignup = async (e) => {
    e.preventDefault();

    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured. Please connect a Supabase project.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email, password, displayName);
      toast.success("Account created! Please check your email to verify.");
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignup = async () => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured. Please connect a Supabase project.");
      return;
    }

    try {
      await signInWithGithub();
    } catch (error) {
      toast.error(error.message || "Failed to sign up with GitHub");
    }
  };

  return (
    <div id="signup-page" className="min-h-screen bg-dark-950 flex items-center justify-center py-12 px-4">
      <Toaster position="top-center" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
              <Code2 className="w-7 h-7 text-white" />
            </div>
          </Link>
          <h1 className="text-3xl font-light text-white mb-2">Create your account</h1>
          <p className="text-lg font-extralight text-dark-400">
            Start collaborating with your team in minutes
          </p>
        </div>

        <div className="bg-dark-800/50 backdrop-blur-sm border border-dark-700 rounded-2xl p-8">
          {!isSupabaseConfigured() && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-lg text-amber-400">
                Supabase is not configured. Please connect a Supabase project to enable authentication.
              </p>
            </div>
          )}

          <Button
            variant="github"
            size="lg"
            className="w-full mb-6"
            icon={Github}
            onClick={handleGithubSignup}
          >
            Continue with GitHub
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-600" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-dark-800/50 text-lg text-dark-400">or</span>
            </div>
          </div>

          <form onSubmit={handleEmailSignup} className="space-y-4" noValidate>
            <Input
              type="text"
              label="Display Name"
              placeholder="Your name"
              icon={User}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              label="Password"
              placeholder="At least 6 characters"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Create Account
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-lg font-extralight text-dark-400">
          Already have an account?{" "}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
