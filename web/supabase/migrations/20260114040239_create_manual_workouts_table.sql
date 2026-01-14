-- Manual Workouts Table
-- First-class relational storage for user-added workouts
-- Replaces the MANUAL_WORKOUTS plan instance approach

CREATE TABLE IF NOT EXISTS public.manual_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,

  -- Full workout data (structure, intervals, TSS, etc.)
  workout_data JSONB NOT NULL,

  -- Optional: Track if this workout was extracted from a training plan
  source_plan_instance_id UUID REFERENCES public.plan_instances(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_workouts_user_date
  ON public.manual_workouts(user_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_manual_workouts_user
  ON public.manual_workouts(user_id);

CREATE INDEX IF NOT EXISTS idx_manual_workouts_source_plan
  ON public.manual_workouts(source_plan_instance_id)
  WHERE source_plan_instance_id IS NOT NULL;

-- Row Level Security
ALTER TABLE public.manual_workouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (CRUD for own workouts)
DROP POLICY IF EXISTS "Users can view their own manual workouts" ON public.manual_workouts;
CREATE POLICY "Users can view their own manual workouts"
  ON public.manual_workouts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own manual workouts" ON public.manual_workouts;
CREATE POLICY "Users can insert their own manual workouts"
  ON public.manual_workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own manual workouts" ON public.manual_workouts;
CREATE POLICY "Users can update their own manual workouts"
  ON public.manual_workouts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own manual workouts" ON public.manual_workouts;
CREATE POLICY "Users can delete their own manual workouts"
  ON public.manual_workouts FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_manual_workouts_updated_at ON public.manual_workouts;
CREATE TRIGGER update_manual_workouts_updated_at
  BEFORE UPDATE ON public.manual_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.manual_workouts IS
  'First-class relational storage for user-added workouts. Replaces the MANUAL_WORKOUTS plan instance approach for 5-40x performance improvements.';

COMMENT ON COLUMN public.manual_workouts.workout_data IS
  'Full workout object including structure, intervals, TSS, etc. in JSONB format.';

COMMENT ON COLUMN public.manual_workouts.source_plan_instance_id IS
  'Optional reference to the training plan instance this workout was extracted from (e.g., when moved outside plan boundaries).';
