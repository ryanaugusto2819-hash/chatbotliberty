DROP POLICY IF EXISTS "Authenticated users can view connection configs" ON public.connection_configs;

CREATE POLICY "Public can view connection status"
ON public.connection_configs
FOR SELECT
TO anon, authenticated
USING (true);