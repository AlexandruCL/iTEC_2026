import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, User, Github, Code2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import FadeIn from "@/components/ui/FadeIn";
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
      toast.error("Please connect a Supabase project first.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email, password, displayName);
      toast.success("Account created! Check your email to verify.");
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignup = async () => {
    if (!isSupabaseConfigured()) {
      toast.error("Please connect a Supabase project first.");
      return;
    }
    try {
      await signInWithGithub();
    } catch (error) {
      toast.error(error.message || "Failed to sign up with GitHub");
    }
  };

  return (
    <div id="signup-page" className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
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
          <h1 className="text-2xl font-bold text-white font-display tracking-tight">Create an account</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Start collaborating in minutes
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
            onClick={handleGithubSignup}
          >
            Sign up with GitHub
          </Button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-neutral-900 text-xs text-neutral-500">or</span>
            </div>
          </div>

          <form onSubmit={handleEmailSignup} className="space-y-4" noValidate>
            <Input
              type="text"
              label="Name"
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
              placeholder="Min. 6 characters"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Create Account
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-neutral-500">
          Already have an account?{" "}
          <Link to="/login" className="text-accent-400 hover:text-accent-300 transition-colors">
            Sign in
          </Link>
        </p>
      </FadeIn>
    </div>
  );
}
