-- LLM Interactions
-- Stores metadata for all LLM API interactions for analytics, cost tracking, and monitoring
-- Full prompts/responses are stored in JSONL files only (not in DB) for debugging purposes

CREATE TABLE IF NOT EXISTS public.llm_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identifiers
  session_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Provider information
  provider_name TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,

  -- Trigger context
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('api_request', 'background_task', 'tool_call', 'system')),
  triggered_by TEXT,

  -- Token metrics
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost DECIMAL(10, 6),  -- USD

  -- Performance metrics
  duration_ms DECIMAL(10, 2),
  api_latency_ms DECIMAL(10, 2),

  -- Error tracking
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_llm_interactions_user_date
  ON public.llm_interactions(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_llm_interactions_session
  ON public.llm_interactions(session_id);

CREATE INDEX IF NOT EXISTS idx_llm_interactions_provider
  ON public.llm_interactions(provider_name, model);

CREATE INDEX IF NOT EXISTS idx_llm_interactions_trigger
  ON public.llm_interactions(trigger_type, triggered_by);

CREATE INDEX IF NOT EXISTS idx_llm_interactions_cost
  ON public.llm_interactions(timestamp DESC, estimated_cost DESC)
  WHERE estimated_cost IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_llm_interactions_timestamp
  ON public.llm_interactions(timestamp DESC);

-- Row Level Security
ALTER TABLE public.llm_interactions ENABLE ROW LEVEL SECURITY;

-- Only admins can view LLM interactions (sensitive analytics data)
DROP POLICY IF EXISTS "Admins can view all llm_interactions" ON public.llm_interactions;
CREATE POLICY "Admins can view all llm_interactions"
  ON public.llm_interactions FOR SELECT
  USING (public.is_admin());

-- Only system can insert interactions (via service role key from Python API)
DROP POLICY IF EXISTS "Service role can insert llm_interactions" ON public.llm_interactions;
CREATE POLICY "Service role can insert llm_interactions"
  ON public.llm_interactions FOR INSERT
  WITH CHECK (true);  -- Service role bypasses RLS anyway, this is for documentation

-- Add comments
COMMENT ON TABLE public.llm_interactions IS
  'Metadata for all LLM API interactions. Excludes prompts/responses (stored in JSONL). For analytics, cost tracking, and performance monitoring.';

COMMENT ON COLUMN public.llm_interactions.session_id IS
  'Session identifier for grouping related interactions (e.g., a workflow execution)';

COMMENT ON COLUMN public.llm_interactions.request_id IS
  'Unique request identifier for tracing a specific API call';

COMMENT ON COLUMN public.llm_interactions.prompt_version IS
  'Version identifier for the prompt template used (e.g., "1.3", "default")';

COMMENT ON COLUMN public.llm_interactions.trigger_type IS
  'How the interaction was initiated: api_request, background_task, tool_call, or system';

COMMENT ON COLUMN public.llm_interactions.triggered_by IS
  'What triggered this interaction (e.g., API endpoint path, task name)';

COMMENT ON COLUMN public.llm_interactions.estimated_cost IS
  'Estimated cost in USD based on model pricing and token counts';

COMMENT ON COLUMN public.llm_interactions.timestamp IS
  'When the interaction occurred (ISO 8601 format with timezone)';
