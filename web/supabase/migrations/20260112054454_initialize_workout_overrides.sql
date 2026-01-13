-- Initialize workout_overrides for all existing plan instances
-- This ensures the column is properly set for rows that existed before the column was added

UPDATE plan_instances
SET workout_overrides = '{"moves": {}, "copies": {}, "deleted": []}'::jsonb
WHERE workout_overrides IS NULL OR workout_overrides = '{}'::jsonb;

-- Force PostgREST to reload schema cache again
NOTIFY pgrst, 'reload schema';
