-- Add coach feedback metadata columns
-- Stores information about the AI model, prompt version, and generation context

-- Coach feedback metadata columns
ALTER TABLE public.workout_compliance_analyses
  ADD COLUMN IF NOT EXISTS coach_model TEXT,
  ADD COLUMN IF NOT EXISTS coach_prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS coach_generated_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN public.workout_compliance_analyses.coach_model IS
  'AI model used to generate coach feedback (e.g., gemini-2.0-flash, claude-3-5-sonnet)';

COMMENT ON COLUMN public.workout_compliance_analyses.coach_prompt_version IS
  'Version of the prompt template used for feedback generation';

COMMENT ON COLUMN public.workout_compliance_analyses.coach_generated_at IS
  'Timestamp when coach feedback was generated';
