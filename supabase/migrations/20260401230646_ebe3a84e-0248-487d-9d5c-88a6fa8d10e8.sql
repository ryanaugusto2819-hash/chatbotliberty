
-- Replace dataset_id with pixel_id in meta_capi_config
ALTER TABLE public.meta_capi_config ADD COLUMN pixel_id text NOT NULL DEFAULT '';

-- Copy dataset_id values to pixel_id as a starting point
UPDATE public.meta_capi_config SET pixel_id = dataset_id;

-- Drop old columns no longer needed
ALTER TABLE public.meta_capi_config DROP COLUMN dataset_id;
ALTER TABLE public.meta_capi_config DROP COLUMN page_id;

-- Remove ctwa_clid from conversion_events (no longer used)
ALTER TABLE public.conversion_events DROP COLUMN IF EXISTS ctwa_clid;
