-- Workout Activity Matches
-- Links scheduled workouts to completed Strava activities
-- Enables tracking planned vs actual performance

CREATE TABLE IF NOT EXISTS public.workout_activity_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Reference to the scheduled workout
  plan_instance_id UUID NOT NULL REFERENCES public.plan_instances(id) ON DELETE CASCADE,
  workout_date DATE NOT NULL,  -- The date of the scheduled workout
  workout_index INTEGER NOT NULL DEFAULT 0,  -- Index if multiple workouts on same date

  -- Reference to the completed activity
  strava_activity_id UUID NOT NULL REFERENCES public.strava_activities(id) ON DELETE CASCADE,

  -- Match metadata
  match_type TEXT NOT NULL CHECK (match_type IN ('auto', 'manual')),
  match_score NUMERIC,  -- 0-100 confidence score for auto matches

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(plan_instance_id, workout_date, workout_index),  -- One match per workout slot
  UNIQUE(strava_activity_id)  -- Each activity can only match one workout
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workout_activity_matches_user
  ON public.workout_activity_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_activity_matches_instance
  ON public.workout_activity_matches(plan_instance_id);
CREATE INDEX IF NOT EXISTS idx_workout_activity_matches_date
  ON public.workout_activity_matches(workout_date);
CREATE INDEX IF NOT EXISTS idx_workout_activity_matches_activity
  ON public.workout_activity_matches(strava_activity_id);

-- Row Level Security
ALTER TABLE public.workout_activity_matches ENABLE ROW LEVEL SECURITY;

-- Users can view their own matches
DROP POLICY IF EXISTS "Users can view their own workout matches" ON public.workout_activity_matches;
CREATE POLICY "Users can view their own workout matches"
  ON public.workout_activity_matches FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own matches
DROP POLICY IF EXISTS "Users can insert their own workout matches" ON public.workout_activity_matches;
CREATE POLICY "Users can insert their own workout matches"
  ON public.workout_activity_matches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own matches
DROP POLICY IF EXISTS "Users can update their own workout matches" ON public.workout_activity_matches;
CREATE POLICY "Users can update their own workout matches"
  ON public.workout_activity_matches FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own matches
DROP POLICY IF EXISTS "Users can delete their own workout matches" ON public.workout_activity_matches;
CREATE POLICY "Users can delete their own workout matches"
  ON public.workout_activity_matches FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_workout_activity_matches_updated_at ON public.workout_activity_matches;
CREATE TRIGGER update_workout_activity_matches_updated_at
  BEFORE UPDATE ON public.workout_activity_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.workout_activity_matches IS
  'Links scheduled workouts from plan instances to completed Strava activities for tracking planned vs actual performance';
