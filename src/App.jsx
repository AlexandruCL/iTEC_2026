import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Session from "@/pages/Session";
import Settings from "@/pages/Settings";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function OAuthCallbackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (handled) return;

    const hash = window.location.hash;
    if (hash && hash.includes("access_token") && isSupabaseConfigured() && supabase) {
      setHandled(true);

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          useAuthStore.getState().setUser(session.user);
          useAuthStore.getState().setSession(session);
          useAuthStore.getState().setLoading(false);
        }
        window.history.replaceState(null, "", location.pathname);
        navigate("/dashboard", { replace: true });
      });
    }
  }, [navigate, location.pathname, handled]);

  return null;
}

function AppContent() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <>
      <ScrollToTop />
      <OAuthCallbackHandler />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/:sessionId"
          element={
            <ProtectedRoute>
              <Session />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
