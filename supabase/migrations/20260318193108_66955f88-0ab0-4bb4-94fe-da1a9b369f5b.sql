
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ai usage logs" ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert ai usage logs" ON public.ai_usage_logs
  FOR INSERT TO public
  WITH CHECK (true);

CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);
CREATE INDEX idx_ai_usage_logs_function_name ON public.ai_usage_logs(function_name);
