import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Code2, LogOut, Settings, User } from "lucide-react";
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
    <header id="app-header" className="fixed top-0 left-0 right-0 z-40 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800">
      <div className="max-w-[2400px] mx-auto">
        <div className="grid grid-cols-12">
          <div className="col-span-12 px-4 md:col-start-2 md:col-span-10">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center gap-2">
                <motion.div
                  whileHover={{ rotate: 180 }}
                  transition={{ duration: 0.3 }}
                  className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center"
                >
                  <Code2 className="w-6 h-6 text-white" />
                </motion.div>
                <span className="text-xl font-semibold text-white">CollabCode</span>
              </Link>

              <nav className="hidden md:flex items-center gap-6">
                {user ? (
                  <>
                    <Link
                      to="/dashboard"
                      className="text-lg font-extralight text-dark-300 hover:text-white transition-colors"
                    >
                      Dashboard
                    </Link>
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dark-800 transition-colors"
                      >
                        <div
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center"
                        >
                          <span className="text-lg font-medium text-white">
                            {user.email?.[0].toUpperCase() || "U"}
                          </span>
                        </div>
                      </button>
                      {menuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl overflow-hidden"
                        >
                          <Link
                            to="/settings"
                            className="flex items-center gap-3 px-4 py-3 text-lg text-dark-200 hover:bg-dark-700 transition-colors"
                            onClick={() => setMenuOpen(false)}
                          >
                            <Settings className="w-4 h-4" />
                            Settings
                          </Link>
                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 w-full px-4 py-3 text-lg text-red-400 hover:bg-dark-700 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Link to="/login">
                      <Button variant="ghost">Sign In</Button>
                    </Link>
                    <Link to="/signup">
                      <Button>Get Started</Button>
                    </Link>
                  </>
                )}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
