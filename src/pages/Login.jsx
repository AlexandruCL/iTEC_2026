import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Mail, Lock, Github, Code2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import toast, { Toaster } from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signInWithEmail, signInWithGithub } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const handleEmailLogin = async (e) => {
    e.preventDefault();

    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured. Please connect a Supabase project.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email, password);
      toast.success("Welcome back!");
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured. Please connect a Supabase project.");
      return;
    }

    try {
      await signInWithGithub();
    } catch (error) {
      toast.error(error.message || "Failed to sign in with GitHub");
    }
  };

  return (
    <div id="login-page" className="min-h-screen bg-dark-950 flex items-center justify-center py-12 px-4">
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
          <h1 className="text-3xl font-light text-white mb-2">Welcome back</h1>
          <p className="text-lg font-extralight text-dark-400">
            Sign in to continue coding together
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
            onClick={handleGithubLogin}
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

          <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
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
              placeholder="Enter your password"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-lg font-extralight text-dark-400">
          Do not have an account?{" "}
          <Link to="/signup" className="text-primary-400 hover:text-primary-300 transition-colors">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
