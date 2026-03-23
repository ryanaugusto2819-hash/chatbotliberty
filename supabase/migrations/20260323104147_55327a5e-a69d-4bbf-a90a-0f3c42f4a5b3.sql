ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS connection_config_id uuid REFERENCES public.connection_configs(id) ON DELETE SET NULL;