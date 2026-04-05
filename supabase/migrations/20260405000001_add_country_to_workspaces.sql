-- ============================================================
-- MIGRATION: Add country field to workspaces
-- Enables Brazil / Uruguay multi-country separation
-- ============================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;

COMMENT ON COLUMN public.workspaces.country IS 'ISO 3166-1 alpha-2 country code: BR (Brazil) or UY (Uruguay)';

CREATE INDEX IF NOT EXISTS idx_workspaces_country ON public.workspaces (country);
