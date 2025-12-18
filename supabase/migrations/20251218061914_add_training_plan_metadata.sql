-- Add metadata column to training_plans table for storing AI generation info
ALTER TABLE training_plans
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN training_plans.metadata IS 'Metadata about plan generation including AI provider, model, and library version';
