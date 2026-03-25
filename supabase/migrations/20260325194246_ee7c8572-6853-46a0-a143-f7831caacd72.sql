
CREATE TABLE public.niche_funnel_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id uuid NOT NULL REFERENCES public.niches(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  strategy text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(niche_id, stage_key)
);

ALTER TABLE public.niche_funnel_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view niche_funnel_stages"
  ON public.niche_funnel_stages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage niche_funnel_stages"
  ON public.niche_funnel_stages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
