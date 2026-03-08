
CREATE TABLE public.connection_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id text NOT NULL,
  is_connected boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(connection_id)
);

ALTER TABLE public.connection_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view connection configs"
ON public.connection_configs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage connection configs"
ON public.connection_configs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
