-- Add LTHR (Lactate Threshold Heart Rate) to athlete profiles
-- LTHR is used for HR-based zone calculations in compliance analysis

ALTER TABLE public.athlete_profiles
ADD COLUMN IF NOT EXISTS lthr INTEGER;

-- Add comment explaining the field
COMMENT ON COLUMN public.athlete_profiles.lthr IS
  'Lactate Threshold Heart Rate in bpm. Used for HR zone calculations. Typically 95-105% of 30-min max HR test.';

-- Add check constraint to ensure reasonable values (40-220 bpm)
ALTER TABLE public.athlete_profiles
ADD CONSTRAINT athlete_profiles_lthr_check
  CHECK (lthr IS NULL OR (lthr >= 40 AND lthr <= 220));
