
CREATE TABLE public.niche_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id uuid NOT NULL REFERENCES public.niches(id) ON DELETE CASCADE,
  connection_config_id uuid NOT NULL REFERENCES public.connection_configs(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (niche_id, connection_config_id)
);

ALTER TABLE public.niche_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view niche_connections"
  ON public.niche_connections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage niche_connections"
  ON public.niche_connections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
