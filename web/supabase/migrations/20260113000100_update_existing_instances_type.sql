-- Update existing plan_instances to have standard instance_type
-- This helps ensure PostgREST recognizes the column exists

UPDATE plan_instances
SET instance_type = 'standard'
WHERE instance_type IS NULL OR instance_type = 'standard';

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
