
CREATE TABLE public.webhook_flow_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key text NOT NULL,
  label text NOT NULL DEFAULT '',
  flow_id uuid REFERENCES public.automation_flows(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (status_key)
);

ALTER TABLE public.webhook_flow_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhook_flow_mappings"
  ON public.webhook_flow_mappings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view webhook_flow_mappings"
  ON public.webhook_flow_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can read webhook_flow_mappings"
  ON public.webhook_flow_mappings FOR SELECT
  TO anon
  USING (true);
