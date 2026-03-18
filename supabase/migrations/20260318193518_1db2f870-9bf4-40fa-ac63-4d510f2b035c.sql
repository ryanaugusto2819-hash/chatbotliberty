
-- Track each flow execution session
CREATE TABLE public.flow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  total_nodes integer NOT NULL DEFAULT 0,
  completed_nodes integer NOT NULL DEFAULT 0,
  failed_at_node_id uuid REFERENCES public.automation_nodes(id) ON DELETE SET NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view flow executions" ON public.flow_executions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service can insert flow executions" ON public.flow_executions
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Service can update flow executions" ON public.flow_executions
  FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE INDEX idx_flow_executions_flow_id ON public.flow_executions(flow_id);
CREATE INDEX idx_flow_executions_created_at ON public.flow_executions(created_at);

-- Track each individual step execution within a flow
CREATE TABLE public.flow_step_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.flow_executions(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES public.automation_nodes(id) ON DELETE CASCADE,
  node_type text NOT NULL,
  node_label text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  executed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_step_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view step logs" ON public.flow_step_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service can insert step logs" ON public.flow_step_logs
  FOR INSERT TO public WITH CHECK (true);

CREATE INDEX idx_flow_step_logs_execution_id ON public.flow_step_logs(execution_id);
CREATE INDEX idx_flow_step_logs_node_id ON public.flow_step_logs(node_id);
