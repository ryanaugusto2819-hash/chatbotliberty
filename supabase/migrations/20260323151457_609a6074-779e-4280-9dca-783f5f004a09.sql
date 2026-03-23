
CREATE TABLE public.manager_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  overall_score integer NOT NULL DEFAULT 0,
  flow_accuracy_score integer NOT NULL DEFAULT 0,
  response_quality_score integer NOT NULL DEFAULT 0,
  context_adherence_score integer NOT NULL DEFAULT 0,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text NOT NULL DEFAULT '',
  flows_analyzed jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)
);

ALTER TABLE public.manager_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view analyses" ON public.manager_analyses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert analyses" ON public.manager_analyses
  FOR ALL TO public
  USING (true) WITH CHECK (true);
