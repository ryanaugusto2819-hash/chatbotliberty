ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS billing_stage text DEFAULT NULL;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS billing_connection_name text DEFAULT NULL;