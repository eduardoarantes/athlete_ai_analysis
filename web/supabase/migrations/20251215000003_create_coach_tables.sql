-- Create tables for AI Coach integration with Python backend

-- Training Plans table
CREATE TABLE IF NOT EXISTS training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  weeks_total INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  plan_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plan Generation Jobs table (tracks async Python CLI execution)
CREATE TABLE IF NOT EXISTS plan_generation_jobs (
  id TEXT PRIMARY KEY, -- Custom ID like "plan_1234567890_abc123de"
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES training_plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  progress JSONB, -- { phase: string, percentage: number }
  params JSONB, -- Wizard inputs
  result JSONB, -- Generated plan data
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coach Chat Sessions table (conversational AI)
CREATE TABLE IF NOT EXISTS coach_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages JSONB[] DEFAULT '{}', -- Array of {role, content}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wizard Sessions table (auto-save wizard progress)
CREATE TABLE IF NOT EXISTS wizard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wizard_data JSONB DEFAULT '{}',
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_plans_user_id ON training_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_status ON training_plans(status);
CREATE INDEX IF NOT EXISTS idx_plan_generation_jobs_user_id ON plan_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_generation_jobs_status ON plan_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_coach_chat_sessions_user_id ON coach_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_wizard_sessions_user_id ON wizard_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_wizard_sessions_status ON wizard_sessions(status);

-- Row Level Security (RLS)
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wizard_sessions ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
DROP POLICY IF EXISTS "Users can view own training plans" ON training_plans;
CREATE POLICY "Users can view own training plans" ON training_plans
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own training plans" ON training_plans;
CREATE POLICY "Users can create own training plans" ON training_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own training plans" ON training_plans;
CREATE POLICY "Users can update own training plans" ON training_plans
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own training plans" ON training_plans;
CREATE POLICY "Users can delete own training plans" ON training_plans
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own plan generation jobs" ON plan_generation_jobs;
CREATE POLICY "Users can view own plan generation jobs" ON plan_generation_jobs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own plan generation jobs" ON plan_generation_jobs;
CREATE POLICY "Users can create own plan generation jobs" ON plan_generation_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own plan generation jobs" ON plan_generation_jobs;
CREATE POLICY "Users can update own plan generation jobs" ON plan_generation_jobs
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own coach chat sessions" ON coach_chat_sessions;
CREATE POLICY "Users can view own coach chat sessions" ON coach_chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own coach chat sessions" ON coach_chat_sessions;
CREATE POLICY "Users can create own coach chat sessions" ON coach_chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own coach chat sessions" ON coach_chat_sessions;
CREATE POLICY "Users can update own coach chat sessions" ON coach_chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own wizard sessions" ON wizard_sessions;
CREATE POLICY "Users can view own wizard sessions" ON wizard_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own wizard sessions" ON wizard_sessions;
CREATE POLICY "Users can create own wizard sessions" ON wizard_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own wizard sessions" ON wizard_sessions;
CREATE POLICY "Users can update own wizard sessions" ON wizard_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_training_plans_updated_at ON training_plans;
CREATE TRIGGER update_training_plans_updated_at
  BEFORE UPDATE ON training_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plan_generation_jobs_updated_at ON plan_generation_jobs;
CREATE TRIGGER update_plan_generation_jobs_updated_at
  BEFORE UPDATE ON plan_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_coach_chat_sessions_updated_at ON coach_chat_sessions;
CREATE TRIGGER update_coach_chat_sessions_updated_at
  BEFORE UPDATE ON coach_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wizard_sessions_updated_at ON wizard_sessions;
CREATE TRIGGER update_wizard_sessions_updated_at
  BEFORE UPDATE ON wizard_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
