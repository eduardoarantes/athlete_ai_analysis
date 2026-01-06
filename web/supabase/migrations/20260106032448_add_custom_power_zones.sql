-- Add custom_power_zones column to athlete_profiles
-- This allows users to customize their power zone thresholds

ALTER TABLE public.athlete_profiles
ADD COLUMN IF NOT EXISTS custom_power_zones JSONB DEFAULT NULL;

COMMENT ON COLUMN public.athlete_profiles.custom_power_zones IS
'Custom power zone thresholds as percentage of FTP. Format: [{"zone": "Z1", "minPct": 0, "maxPct": 56}, ...]';
