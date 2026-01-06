-- Workout Compliance Analyses
-- Stores the results of workout compliance analysis for matched workout-activity pairs
-- This enables historical tracking and avoids re-computing analysis each time

CREATE TABLE IF NOT EXISTS public.workout_compliance_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the workout-activity match
  match_id UUID NOT NULL REFERENCES public.workout_activity_matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Overall compliance results
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  overall_grade TEXT NOT NULL CHECK (overall_grade IN ('A', 'B', 'C', 'D', 'F')),
  overall_summary TEXT NOT NULL,

  -- Segment counts
  segments_completed INTEGER NOT NULL DEFAULT 0,
  segments_skipped INTEGER NOT NULL DEFAULT 0,
  segments_total INTEGER NOT NULL DEFAULT 0,

  -- Full analysis data (includes per-segment breakdown)
  analysis_data JSONB NOT NULL,

  -- Athlete context at time of analysis
  athlete_ftp INTEGER NOT NULL,
  athlete_lthr INTEGER,

  -- AI Coach feedback (optional, generated separately)
  coach_feedback JSONB,

  -- Metadata
  algorithm_version TEXT NOT NULL DEFAULT '1.0.0',
  power_data_quality TEXT NOT NULL CHECK (power_data_quality IN ('good', 'partial', 'missing')),
  hr_data_quality TEXT CHECK (hr_data_quality IN ('good', 'partial', 'missing')),

  -- Timestamps
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each match can only have one compliance analysis
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_analyses_match
  ON public.workout_compliance_analyses(match_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_compliance_analyses_user
  ON public.workout_compliance_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_analyses_score
  ON public.workout_compliance_analyses(overall_score);
CREATE INDEX IF NOT EXISTS idx_compliance_analyses_grade
  ON public.workout_compliance_analyses(overall_grade);
CREATE INDEX IF NOT EXISTS idx_compliance_analyses_analyzed_at
  ON public.workout_compliance_analyses(analyzed_at DESC);

-- Row Level Security
ALTER TABLE public.workout_compliance_analyses ENABLE ROW LEVEL SECURITY;

-- Users can view their own analyses
DROP POLICY IF EXISTS "Users can view their own compliance analyses" ON public.workout_compliance_analyses;
CREATE POLICY "Users can view their own compliance analyses"
  ON public.workout_compliance_analyses FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own analyses
DROP POLICY IF EXISTS "Users can insert their own compliance analyses" ON public.workout_compliance_analyses;
CREATE POLICY "Users can insert their own compliance analyses"
  ON public.workout_compliance_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own analyses (e.g., to add coach feedback)
DROP POLICY IF EXISTS "Users can update their own compliance analyses" ON public.workout_compliance_analyses;
CREATE POLICY "Users can update their own compliance analyses"
  ON public.workout_compliance_analyses FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own analyses
DROP POLICY IF EXISTS "Users can delete their own compliance analyses" ON public.workout_compliance_analyses;
CREATE POLICY "Users can delete their own compliance analyses"
  ON public.workout_compliance_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_workout_compliance_analyses_updated_at ON public.workout_compliance_analyses;
CREATE TRIGGER update_workout_compliance_analyses_updated_at
  BEFORE UPDATE ON public.workout_compliance_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.workout_compliance_analyses IS
  'Stores workout compliance analysis results comparing planned workouts to actual Strava activities';

COMMENT ON COLUMN public.workout_compliance_analyses.analysis_data IS
  'Full analysis JSON including per-segment breakdown, scores, and assessments';

COMMENT ON COLUMN public.workout_compliance_analyses.coach_feedback IS
  'AI-generated coaching feedback with summary, positives, improvements, and tips';
