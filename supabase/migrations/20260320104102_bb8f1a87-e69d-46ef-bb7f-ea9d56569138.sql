
-- Add columns for multi-connection and status support
ALTER TABLE public.connection_configs 
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

-- Drop unique constraint on connection_id to allow multiple connections of same type
DO $$ 
DECLARE _c text;
BEGIN
  SELECT conname INTO _c FROM pg_constraint 
  WHERE conrelid = 'public.connection_configs'::regclass 
  AND contype = 'u'
  AND EXISTS (
    SELECT 1 FROM unnest(conkey) k 
    JOIN pg_attribute a ON a.attnum = k AND a.attrelid = conrelid 
    WHERE a.attname = 'connection_id'
  );
  IF _c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.connection_configs DROP CONSTRAINT %I', _c);
  END IF;
END $$;
