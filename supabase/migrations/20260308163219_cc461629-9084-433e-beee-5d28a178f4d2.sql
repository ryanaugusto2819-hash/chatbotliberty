
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS ctwa_clid TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS source_id TEXT;
