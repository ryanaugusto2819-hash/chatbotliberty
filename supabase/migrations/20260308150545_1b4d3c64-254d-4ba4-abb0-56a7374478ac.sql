-- Automation flows table
CREATE TABLE public.automation_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Novo Fluxo',
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  trigger_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view flows"
  ON public.automation_flows FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert flows"
  ON public.automation_flows FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update flows"
  ON public.automation_flows FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete flows"
  ON public.automation_flows FOR DELETE TO authenticated
  USING (true);

-- Automation nodes table
CREATE TABLE public.automation_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  node_type text NOT NULL DEFAULT 'message',
  label text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position_x float NOT NULL DEFAULT 0,
  position_y float NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view nodes"
  ON public.automation_nodes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert nodes"
  ON public.automation_nodes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update nodes"
  ON public.automation_nodes FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete nodes"
  ON public.automation_nodes FOR DELETE TO authenticated
  USING (true);

-- Automation edges (connections between nodes)
CREATE TABLE public.automation_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES public.automation_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES public.automation_nodes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view edges"
  ON public.automation_edges FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert edges"
  ON public.automation_edges FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update edges"
  ON public.automation_edges FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete edges"
  ON public.automation_edges FOR DELETE TO authenticated
  USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_automation_flows_updated_at
  BEFORE UPDATE ON public.automation_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_automation_nodes_updated_at
  BEFORE UPDATE ON public.automation_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for automation media
INSERT INTO storage.buckets (id, name, public) VALUES ('automation-media', 'automation-media', true);

CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'automation-media');

CREATE POLICY "Anyone can view automation media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'automation-media');

CREATE POLICY "Authenticated users can delete their media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'automation-media');

-- Enable realtime for flows
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_flows;