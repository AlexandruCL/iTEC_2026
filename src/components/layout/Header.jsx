import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Code2, LogOut, Settings } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import Button from "@/components/ui/Button";

export default function Header() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header id="app-header" className="fixed top-0 left-0 right-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-neutral-950" />
            </div>
            <span className="text-lg font-semibold text-white font-display tracking-tight">iTECify</span>
          </Link>

          <nav className="flex items-center gap-6">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-sm font-bold text-neutral-950 hover:bg-accent-400 transition-colors"
                  >
                    {user.email?.[0].toUpperCase() || "U"}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl overflow-hidden py-1">
                      <Link
                        to="/settings"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors w-full"
                        onClick={() => setMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4 text-neutral-500" />
                        Settings
                      </Link>
                      <div className="h-px bg-neutral-800 my-0.5" />
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
