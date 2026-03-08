-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can view flows" ON public.automation_flows;
DROP POLICY IF EXISTS "Authenticated users can insert flows" ON public.automation_flows;
DROP POLICY IF EXISTS "Authenticated users can update flows" ON public.automation_flows;
DROP POLICY IF EXISTS "Authenticated users can delete flows" ON public.automation_flows;

DROP POLICY IF EXISTS "Authenticated users can view nodes" ON public.automation_nodes;
DROP POLICY IF EXISTS "Authenticated users can insert nodes" ON public.automation_nodes;
DROP POLICY IF EXISTS "Authenticated users can update nodes" ON public.automation_nodes;
DROP POLICY IF EXISTS "Authenticated users can delete nodes" ON public.automation_nodes;

DROP POLICY IF EXISTS "Authenticated users can view edges" ON public.automation_edges;
DROP POLICY IF EXISTS "Authenticated users can insert edges" ON public.automation_edges;
DROP POLICY IF EXISTS "Authenticated users can update edges" ON public.automation_edges;
DROP POLICY IF EXISTS "Authenticated users can delete edges" ON public.automation_edges;

-- Recreate as permissive policies (matching conversations/messages pattern)
CREATE POLICY "Anyone can view flows" ON public.automation_flows FOR SELECT USING (true);
CREATE POLICY "Anyone can insert flows" ON public.automation_flows FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update flows" ON public.automation_flows FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete flows" ON public.automation_flows FOR DELETE USING (true);

CREATE POLICY "Anyone can view nodes" ON public.automation_nodes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert nodes" ON public.automation_nodes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update nodes" ON public.automation_nodes FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete nodes" ON public.automation_nodes FOR DELETE USING (true);

CREATE POLICY "Anyone can view edges" ON public.automation_edges FOR SELECT USING (true);
CREATE POLICY "Anyone can insert edges" ON public.automation_edges FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update edges" ON public.automation_edges FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete edges" ON public.automation_edges FOR DELETE USING (true);