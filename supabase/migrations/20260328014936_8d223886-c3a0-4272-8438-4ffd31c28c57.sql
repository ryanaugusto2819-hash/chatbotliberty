
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  contact_name text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping_found boolean NOT NULL DEFAULT false,
  flow_id uuid REFERENCES public.automation_flows(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  result jsonb DEFAULT '{}'::jsonb,
  error text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhook_logs" ON public.webhook_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view webhook_logs" ON public.webhook_logs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service can insert webhook_logs" ON public.webhook_logs
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs (created_at DESC);
CREATE INDEX idx_webhook_logs_status_key ON public.webhook_logs (status_key);
