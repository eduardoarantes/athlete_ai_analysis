-- Migration: Add schedule editing support
-- Allows users to move, copy, and delete workouts from their scheduled plan instances

-- Add workout overrides column to plan_instances
-- This stores user modifications without altering the original plan_data snapshot
ALTER TABLE plan_instances
ADD COLUMN IF NOT EXISTS workout_overrides JSONB DEFAULT '{}'::jsonb;

-- Structure of workout_overrides:
-- {
--   "moves": {
--     "2026-01-15:0": {
--       "original_date": "2026-01-14",
--       "original_index": 1,
--       "moved_at": "2026-01-08T10:30:00Z"
--     }
--   },
--   "copies": {
--     "2026-01-16:0": {
--       "source_date": "2026-01-10",
--       "source_index": 0,
--       "copied_at": "2026-01-08T10:30:00Z"
--     }
--   },
--   "deleted": ["2026-01-12:0", "2026-01-13:1"]
-- }

-- Add comment explaining the column
COMMENT ON COLUMN plan_instances.workout_overrides IS
  'User modifications to scheduled workouts. Keys are "YYYY-MM-DD:index" format. Structure: { moves: {}, copies: {}, deleted: [] }';

-- Add index for efficiently finding modified instances
CREATE INDEX IF NOT EXISTS idx_plan_instances_has_overrides
ON plan_instances ((workout_overrides != '{}'::jsonb))
WHERE workout_overrides != '{}'::jsonb;
