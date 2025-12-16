-- Add resting_hr to athlete_profiles for hrTSS calculation
ALTER TABLE public.athlete_profiles
ADD COLUMN IF NOT EXISTS resting_hr INTEGER CHECK (resting_hr >= 30 AND resting_hr <= 100);

-- Add TSS fields to strava_activities table
ALTER TABLE public.strava_activities
ADD COLUMN IF NOT EXISTS tss NUMERIC,
ADD COLUMN IF NOT EXISTS tss_method TEXT CHECK (tss_method IN ('power', 'heart_rate', 'estimated'));

-- Add TSS fields to activities table (for consistency)
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS tss NUMERIC,
ADD COLUMN IF NOT EXISTS tss_method TEXT CHECK (tss_method IN ('power', 'heart_rate', 'estimated'));

-- Create index for TSS queries
CREATE INDEX IF NOT EXISTS idx_strava_activities_tss ON public.strava_activities(user_id, tss) WHERE tss IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_tss ON public.activities(user_id, tss) WHERE tss IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN public.athlete_profiles.resting_hr IS 'Resting heart rate in bpm, used for hrTSS calculation';
COMMENT ON COLUMN public.strava_activities.tss IS 'Training Stress Score calculated from power (TSS) or heart rate (hrTSS)';
COMMENT ON COLUMN public.strava_activities.tss_method IS 'Method used to calculate TSS: power (NP-based), heart_rate (TRIMP-based), or estimated';
COMMENT ON COLUMN public.activities.tss IS 'Training Stress Score calculated from power (TSS) or heart rate (hrTSS)';
COMMENT ON COLUMN public.activities.tss_method IS 'Method used to calculate TSS: power (NP-based), heart_rate (TRIMP-based), or estimated';
