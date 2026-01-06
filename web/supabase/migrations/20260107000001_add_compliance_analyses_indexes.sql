-- Add indexes to workout_compliance_analyses for better query performance

-- Index on match_id for looking up analyses by match
CREATE INDEX IF NOT EXISTS idx_workout_compliance_analyses_match_id
  ON public.workout_compliance_analyses(match_id);

-- Index on user_id for user-specific queries
CREATE INDEX IF NOT EXISTS idx_workout_compliance_analyses_user_id
  ON public.workout_compliance_analyses(user_id);

-- Index on analyzed_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_workout_compliance_analyses_analyzed_at
  ON public.workout_compliance_analyses(analyzed_at DESC);
