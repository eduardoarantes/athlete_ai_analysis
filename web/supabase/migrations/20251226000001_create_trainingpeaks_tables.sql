-- Create trainingpeaks_connections table
CREATE TABLE IF NOT EXISTS public.trainingpeaks_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tp_athlete_id TEXT NOT NULL,           -- TrainingPeaks athlete ID
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,                   -- e.g., "athlete:profile workouts:plan"
  is_premium BOOLEAN DEFAULT false,      -- Track if user has Premium (can sync)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(tp_athlete_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trainingpeaks_connections_user_id ON public.trainingpeaks_connections(user_id);

-- Row Level Security (RLS) Policies for trainingpeaks_connections
ALTER TABLE public.trainingpeaks_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own TP connection" ON public.trainingpeaks_connections;
CREATE POLICY "Users can view their own TP connection"
  ON public.trainingpeaks_connections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own TP connection" ON public.trainingpeaks_connections;
CREATE POLICY "Users can insert their own TP connection"
  ON public.trainingpeaks_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own TP connection" ON public.trainingpeaks_connections;
CREATE POLICY "Users can update their own TP connection"
  ON public.trainingpeaks_connections FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own TP connection" ON public.trainingpeaks_connections;
CREATE POLICY "Users can delete their own TP connection"
  ON public.trainingpeaks_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_trainingpeaks_connections_updated_at ON public.trainingpeaks_connections;
CREATE TRIGGER update_trainingpeaks_connections_updated_at
  BEFORE UPDATE ON public.trainingpeaks_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trainingpeaks_workout_syncs table
CREATE TABLE IF NOT EXISTS public.trainingpeaks_workout_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_instance_id UUID NOT NULL REFERENCES plan_instances(id) ON DELETE CASCADE,

  -- Workout identification within the plan
  week_number INTEGER NOT NULL,
  workout_index INTEGER NOT NULL,          -- Index within week's workouts array
  workout_date DATE NOT NULL,              -- Calculated workout date

  -- TrainingPeaks identifiers
  tp_workout_id TEXT,                      -- TrainingPeaks workout ID (returned after creation)

  -- Sync status
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'deleted')),
  sync_error TEXT,
  last_sync_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one sync record per workout per instance
  UNIQUE(plan_instance_id, week_number, workout_index)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tp_workout_syncs_user_id ON public.trainingpeaks_workout_syncs(user_id);
CREATE INDEX IF NOT EXISTS idx_tp_workout_syncs_instance ON public.trainingpeaks_workout_syncs(plan_instance_id);
CREATE INDEX IF NOT EXISTS idx_tp_workout_syncs_status ON public.trainingpeaks_workout_syncs(sync_status);

-- RLS Policies for trainingpeaks_workout_syncs
ALTER TABLE public.trainingpeaks_workout_syncs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own workout syncs" ON public.trainingpeaks_workout_syncs;
CREATE POLICY "Users can view their own workout syncs"
  ON public.trainingpeaks_workout_syncs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own workout syncs" ON public.trainingpeaks_workout_syncs;
CREATE POLICY "Users can insert their own workout syncs"
  ON public.trainingpeaks_workout_syncs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own workout syncs" ON public.trainingpeaks_workout_syncs;
CREATE POLICY "Users can update their own workout syncs"
  ON public.trainingpeaks_workout_syncs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own workout syncs" ON public.trainingpeaks_workout_syncs;
CREATE POLICY "Users can delete their own workout syncs"
  ON public.trainingpeaks_workout_syncs FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_trainingpeaks_workout_syncs_updated_at ON public.trainingpeaks_workout_syncs;
CREATE TRIGGER update_trainingpeaks_workout_syncs_updated_at
  BEFORE UPDATE ON public.trainingpeaks_workout_syncs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
