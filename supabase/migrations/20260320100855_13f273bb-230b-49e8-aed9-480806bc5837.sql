
-- Create niches table
CREATE TABLE public.niches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp_phone_number_id text,
  zapi_instance_id text,
  system_prompt text NOT NULL DEFAULT 'Você é um assistente virtual amigável. Responda de forma concisa e útil em português brasileiro.',
  flow_selector_instructions text NOT NULL DEFAULT '',
  auto_reply_enabled boolean NOT NULL DEFAULT false,
  flow_selector_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add niche_id to related tables
ALTER TABLE public.conversations ADD COLUMN niche_id uuid REFERENCES public.niches(id) ON DELETE SET NULL;
ALTER TABLE public.knowledge_base_items ADD COLUMN niche_id uuid REFERENCES public.niches(id) ON DELETE CASCADE;
ALTER TABLE public.automation_flows ADD COLUMN niche_id uuid REFERENCES public.niches(id) ON DELETE SET NULL;

-- RLS for niches
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view niches" ON public.niches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage niches" ON public.niches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update trigger for updated_at
CREATE TRIGGER update_niches_updated_at
  BEFORE UPDATE ON public.niches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
