-- Force PostgREST to reload schema cache
-- This ensures the instance_type column is visible to the API layer

NOTIFY pgrst, 'reload schema';
