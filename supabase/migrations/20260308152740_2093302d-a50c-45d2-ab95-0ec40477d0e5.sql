
-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Anyone can view flows" ON public.automation_flows;
DROP POLICY IF EXISTS "Anyone can insert flows" ON public.automation_flows;
DROP POLICY IF EXISTS "Anyone can update flows" ON public.automation_flows;
DROP POLICY IF EXISTS "Anyone can delete flows" ON public.automation_flows;

DROP POLICY IF EXISTS "Anyone can view nodes" ON public.automation_nodes;
DROP POLICY IF EXISTS "Anyone can insert nodes" ON public.automation_nodes;
DROP POLICY IF EXISTS "Anyone can update nodes" ON public.automation_nodes;
DROP POLICY IF EXISTS "Anyone can delete nodes" ON public.automation_nodes;

DROP POLICY IF EXISTS "Anyone can view edges" ON public.automation_edges;
DROP POLICY IF EXISTS "Anyone can insert edges" ON public.automation_edges;
DROP POLICY IF EXISTS "Anyone can update edges" ON public.automation_edges;
DROP POLICY IF EXISTS "Anyone can delete edges" ON public.automation_edges;

-- Recreate as PERMISSIVE
CREATE POLICY "Allow all on flows" ON public.automation_flows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on nodes" ON public.automation_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on edges" ON public.automation_edges FOR ALL USING (true) WITH CHECK (true);
