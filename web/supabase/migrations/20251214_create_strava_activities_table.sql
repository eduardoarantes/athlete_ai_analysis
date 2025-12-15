-- Create strava_activities table
CREATE TABLE IF NOT EXISTS public.strava_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_activity_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sport_type TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  distance NUMERIC,
  moving_time INTEGER,
  elapsed_time INTEGER,
  total_elevation_gain NUMERIC,
  average_watts NUMERIC,
  max_watts NUMERIC,
  weighted_average_watts NUMERIC,
  average_heartrate NUMERIC,
  max_heartrate NUMERIC,
  raw_data JSONB, -- Store full Strava activity object
  fit_file_path TEXT, -- Path to FIT file in Supabase Storage
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(strava_activity_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_id ON public.strava_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_strava_id ON public.strava_activities(strava_activity_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_start_date ON public.strava_activities(start_date);
CREATE INDEX IF NOT EXISTS idx_strava_activities_type ON public.strava_activities(type);

-- Row Level Security (RLS) Policies
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activities" ON public.strava_activities;
CREATE POLICY "Users can view their own activities"
  ON public.strava_activities FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own activities" ON public.strava_activities;
CREATE POLICY "Users can insert their own activities"
  ON public.strava_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own activities" ON public.strava_activities;
CREATE POLICY "Users can update their own activities"
  ON public.strava_activities FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own activities" ON public.strava_activities;
CREATE POLICY "Users can delete their own activities"
  ON public.strava_activities FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_strava_activities_updated_at ON public.strava_activities;
CREATE TRIGGER update_strava_activities_updated_at
  BEFORE UPDATE ON public.strava_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
