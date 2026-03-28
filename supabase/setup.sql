-- =============================================
-- CollabCode: Database Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. PROFILES TABLE (for display name uniqueness)
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- SELECT: Any authenticated user can read profiles (needed for uniqueness check)
CREATE POLICY "Users can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can only create their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Index for faster display_name lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name_lower
  ON public.profiles (LOWER(display_name));

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(
      EXCLUDED.display_name,
      public.profiles.display_name
    ),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================
-- 2. SESSIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'javascript',
  code TEXT DEFAULT '',
  collaborators JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can join a session by ID" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated users can view any session" ON public.sessions;
DROP POLICY IF EXISTS "Users can create own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated users can update any session" ON public.sessions;
DROP POLICY IF EXISTS "Owners can delete own sessions" ON public.sessions;

-- SELECT: Any authenticated user can read any session (needed for shared links)
CREATE POLICY "Authenticated users can view any session"
  ON public.sessions
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can only create sessions under their own user_id
CREATE POLICY "Users can create own sessions"
  ON public.sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Any authenticated user can update any session (collaborative editing)
CREATE POLICY "Authenticated users can update any session"
  ON public.sessions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Only the owner can delete their sessions
CREATE POLICY "Owners can delete own sessions"
  ON public.sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);


-- =============================================
-- 3. SESSION TIMELINE (Time-Travel Debugging)
-- =============================================
CREATE TABLE IF NOT EXISTS public.session_timeline_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  path TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_timeline_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  event_id BIGINT REFERENCES public.session_timeline_events(id) ON DELETE CASCADE,
  fs JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.session_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_timeline_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view timeline events" ON public.session_timeline_events;
DROP POLICY IF EXISTS "Authenticated users can insert timeline events" ON public.session_timeline_events;
DROP POLICY IF EXISTS "Authenticated users can view timeline snapshots" ON public.session_timeline_snapshots;
DROP POLICY IF EXISTS "Authenticated users can insert timeline snapshots" ON public.session_timeline_snapshots;

CREATE POLICY "Authenticated users can view timeline events"
  ON public.session_timeline_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert timeline events"
  ON public.session_timeline_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_user_id);

CREATE POLICY "Authenticated users can view timeline snapshots"
  ON public.session_timeline_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert timeline snapshots"
  ON public.session_timeline_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.session_timeline_events e
      WHERE e.id = event_id
        AND e.actor_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_timeline_events_session_id_id
  ON public.session_timeline_events(session_id, id);

CREATE INDEX IF NOT EXISTS idx_timeline_events_session_created
  ON public.session_timeline_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_timeline_snapshots_session_event
  ON public.session_timeline_snapshots(session_id, event_id);
