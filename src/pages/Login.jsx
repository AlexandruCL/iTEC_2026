import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, Github, Code2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import FadeIn from "@/components/ui/FadeIn";
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
      toast.error("Please connect a Supabase project first.");
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
      toast.error("Please connect a Supabase project first.");
      return;
    }
    try {
      await signInWithGithub();
    } catch (error) {
      toast.error(error.message || "Failed to sign in with GitHub");
    }
  };

  return (
    <div id="login-page" className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#18181b", color: "#fafafa", border: "1px solid #27272a" },
        }}
      />

      <FadeIn className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-neutral-950" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white font-display tracking-tight">Welcome back</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Sign in to your account
          </p>
        </div>

        <div className="surface rounded-2xl p-7">
          {!isSupabaseConfigured() && (
            <div className="mb-5 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400">
                Connect a Supabase project to enable authentication.
              </p>
            </div>
          )}

          <Button
            variant="github"
            size="lg"
            className="w-full mb-5"
            icon={Github}
            onClick={handleGithubLogin}
          >
            Continue with GitHub
          </Button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-neutral-900 text-xs text-neutral-500">or</span>
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
              placeholder="••••••••"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-neutral-500">
          Don't have an account?{" "}
          <Link to="/signup" className="text-accent-400 hover:text-accent-300 transition-colors">
            Sign up
          </Link>
        </p>
      </FadeIn>
    </div>
  );
}
