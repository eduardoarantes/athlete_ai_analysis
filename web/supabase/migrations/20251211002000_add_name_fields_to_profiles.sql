-- Add first_name and last_name columns to athlete_profiles table
ALTER TABLE public.athlete_profiles
ADD COLUMN first_name TEXT NOT NULL DEFAULT '',
ADD COLUMN last_name TEXT NOT NULL DEFAULT '';

-- Remove the default constraint after adding the columns
ALTER TABLE public.athlete_profiles
ALTER COLUMN first_name DROP DEFAULT,
ALTER COLUMN last_name DROP DEFAULT;

-- Add constraints for name fields
ALTER TABLE public.athlete_profiles
ADD CONSTRAINT first_name_length CHECK (length(first_name) >= 1 AND length(first_name) <= 50),
ADD CONSTRAINT last_name_length CHECK (length(last_name) >= 1 AND length(last_name) <= 50);
