-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Athlete Profiles
CREATE TABLE public.athlete_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Profile data
  ftp INTEGER CHECK (ftp > 0 AND ftp < 600),
  max_hr INTEGER CHECK (max_hr >= 100 AND max_hr <= 220),
  weight_kg DECIMAL(5,2) CHECK (weight_kg > 0 AND weight_kg < 300),
  age INTEGER CHECK (age >= 13 AND age <= 120),
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),

  -- Goals (JSON array of strings)
  goals JSONB DEFAULT '[]'::jsonb,

  -- Preferences
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'pt', 'es', 'fr')),
  timezone TEXT DEFAULT 'UTC',
  units_system TEXT DEFAULT 'metric' CHECK (units_system IN ('metric', 'imperial')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id)
);

-- Strava Connections
CREATE TABLE public.strava_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Strava OAuth data
  strava_athlete_id BIGINT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,

  -- Sync metadata
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  sync_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id),
  UNIQUE(strava_athlete_id)
);

-- Activities (synced from Strava)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Strava reference
  strava_activity_id BIGINT NOT NULL,

  -- Activity data
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sport_type TEXT,
  start_date TIMESTAMPTZ NOT NULL,

  -- Metrics
  distance_meters DECIMAL(10,2),
  moving_time_seconds INTEGER,
  elapsed_time_seconds INTEGER,
  total_elevation_gain DECIMAL(10,2),

  -- Power data
  average_watts DECIMAL(10,2),
  max_watts DECIMAL(10,2),
  weighted_average_watts DECIMAL(10,2),

  -- Heart rate data
  average_heartrate DECIMAL(5,2),
  max_heartrate INTEGER,

  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb,

  -- FIT file reference
  fit_file_url TEXT,
  fit_file_processed BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(strava_activity_id)
);

-- Indexes for activities (critical for query performance)
CREATE INDEX idx_activities_user_date ON public.activities(user_id, start_date DESC);
CREATE INDEX idx_activities_strava_id ON public.activities(strava_activity_id);
CREATE INDEX idx_activities_type ON public.activities(user_id, type);

-- Training Plans
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Plan details
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Generated plan data (structured JSON from AI)
  plan_data JSONB NOT NULL,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_training_plans_user ON public.training_plans(user_id, status);

-- Reports (AI-generated reports)
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Report details
  report_type TEXT NOT NULL CHECK (report_type IN ('performance', 'training_plan', 'comprehensive')),
  period_start DATE,
  period_end DATE,

  -- Generation data
  config JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,

  -- Output
  report_url TEXT,
  report_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_user_date ON public.reports(user_id, created_at DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updated_at
CREATE TRIGGER update_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_strava_connections_updated_at
  BEFORE UPDATE ON public.strava_connections
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_training_plans_updated_at
  BEFORE UPDATE ON public.training_plans
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
