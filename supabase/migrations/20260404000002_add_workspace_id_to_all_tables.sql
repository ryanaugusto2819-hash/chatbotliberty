-- ============================================================
-- MIGRATION: Add workspace_id to all tenant-scoped tables
-- and rewrite RLS policies with workspace isolation
-- ============================================================

-- Helper macro: adds workspace_id column + FK + index to a table
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id ON public.conversations (workspace_id);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON public.messages (workspace_id);

ALTER TABLE public.connection_configs
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_connection_configs_workspace_id ON public.connection_configs (workspace_id);

ALTER TABLE public.niches
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_niches_workspace_id ON public.niches (workspace_id);

ALTER TABLE public.niche_connections
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_niche_connections_workspace_id ON public.niche_connections (workspace_id);

ALTER TABLE public.niche_funnel_stages
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_niche_funnel_stages_workspace_id ON public.niche_funnel_stages (workspace_id);

ALTER TABLE public.automation_flows
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_automation_flows_workspace_id ON public.automation_flows (workspace_id);

ALTER TABLE public.automation_nodes
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_automation_nodes_workspace_id ON public.automation_nodes (workspace_id);

ALTER TABLE public.automation_edges
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_automation_edges_workspace_id ON public.automation_edges (workspace_id);

ALTER TABLE public.flow_executions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_flow_executions_workspace_id ON public.flow_executions (workspace_id);

ALTER TABLE public.flow_step_logs
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_flow_step_logs_workspace_id ON public.flow_step_logs (workspace_id);

ALTER TABLE public.follow_up_templates
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_follow_up_templates_workspace_id ON public.follow_up_templates (workspace_id);

ALTER TABLE public.follow_up_executions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_follow_up_executions_workspace_id ON public.follow_up_executions (workspace_id);

ALTER TABLE public.knowledge_base_items
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_workspace_id ON public.knowledge_base_items (workspace_id);

ALTER TABLE public.quick_messages
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quick_messages_workspace_id ON public.quick_messages (workspace_id);

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tags_workspace_id ON public.tags (workspace_id);

ALTER TABLE public.contact_tags
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_contact_tags_workspace_id ON public.contact_tags (workspace_id);

ALTER TABLE public.manager_config
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_manager_config_workspace_id ON public.manager_config (workspace_id);

ALTER TABLE public.manager_analyses
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_manager_analyses_workspace_id ON public.manager_analyses (workspace_id);

ALTER TABLE public.meta_capi_config
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_meta_capi_config_workspace_id ON public.meta_capi_config (workspace_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_orders_workspace_id ON public.orders (workspace_id);

ALTER TABLE public.conversion_events
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_conversion_events_workspace_id ON public.conversion_events (workspace_id);

ALTER TABLE public.conversion_leads
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_conversion_leads_workspace_id ON public.conversion_leads (workspace_id);

ALTER TABLE public.webhook_flow_mappings
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_webhook_flow_mappings_workspace_id ON public.webhook_flow_mappings (workspace_id);

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_workspace_id ON public.webhook_logs (workspace_id);

ALTER TABLE public.agent_assignment_history
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_agent_assignment_history_workspace_id ON public.agent_assignment_history (workspace_id);

ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_workspace_id ON public.ai_usage_logs (workspace_id);

ALTER TABLE public.pending_ai_replies
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pending_ai_replies_workspace_id ON public.pending_ai_replies (workspace_id);

-- ============================================================
-- REWRITE RLS POLICIES with workspace-scoped isolation
-- Drop ALL existing permissive USING(true) policies first
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM   pg_policies
    WHERE  schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- -------- conversations --------
CREATE POLICY "workspace_members_conversations"
  ON public.conversations FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- messages --------
CREATE POLICY "workspace_members_messages"
  ON public.messages FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- connection_configs --------
CREATE POLICY "workspace_members_connection_configs"
  ON public.connection_configs FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- niches --------
CREATE POLICY "workspace_members_niches"
  ON public.niches FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- niche_connections --------
CREATE POLICY "workspace_members_niche_connections"
  ON public.niche_connections FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- niche_funnel_stages --------
CREATE POLICY "workspace_members_niche_funnel_stages"
  ON public.niche_funnel_stages FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- automation_flows --------
CREATE POLICY "workspace_members_automation_flows"
  ON public.automation_flows FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- automation_nodes --------
CREATE POLICY "workspace_members_automation_nodes"
  ON public.automation_nodes FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- automation_edges --------
CREATE POLICY "workspace_members_automation_edges"
  ON public.automation_edges FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- flow_executions --------
CREATE POLICY "workspace_members_flow_executions"
  ON public.flow_executions FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- flow_step_logs --------
CREATE POLICY "workspace_members_flow_step_logs"
  ON public.flow_step_logs FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- follow_up_templates --------
CREATE POLICY "workspace_members_follow_up_templates"
  ON public.follow_up_templates FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- follow_up_executions --------
CREATE POLICY "workspace_members_follow_up_executions"
  ON public.follow_up_executions FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- knowledge_base_items --------
CREATE POLICY "workspace_members_knowledge_base_items"
  ON public.knowledge_base_items FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- quick_messages --------
CREATE POLICY "workspace_members_quick_messages"
  ON public.quick_messages FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- tags --------
CREATE POLICY "workspace_members_tags"
  ON public.tags FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- contact_tags --------
CREATE POLICY "workspace_members_contact_tags"
  ON public.contact_tags FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- manager_config --------
CREATE POLICY "workspace_members_manager_config"
  ON public.manager_config FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- manager_analyses --------
CREATE POLICY "workspace_members_manager_analyses"
  ON public.manager_analyses FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- meta_capi_config --------
CREATE POLICY "workspace_members_meta_capi_config"
  ON public.meta_capi_config FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- orders --------
CREATE POLICY "workspace_members_orders"
  ON public.orders FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- conversion_events --------
CREATE POLICY "workspace_members_conversion_events"
  ON public.conversion_events FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- conversion_leads --------
CREATE POLICY "workspace_members_conversion_leads"
  ON public.conversion_leads FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- webhook_flow_mappings --------
CREATE POLICY "workspace_members_webhook_flow_mappings"
  ON public.webhook_flow_mappings FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- webhook_logs --------
CREATE POLICY "workspace_members_webhook_logs"
  ON public.webhook_logs FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- agent_assignment_history --------
CREATE POLICY "workspace_members_agent_assignment_history"
  ON public.agent_assignment_history FOR ALL
  USING (user_is_member_of_workspace(auth.uid(), workspace_id))
  WITH CHECK (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- ai_usage_logs (service writes, members read) --------
CREATE POLICY "workspace_members_read_ai_usage_logs"
  ON public.ai_usage_logs FOR SELECT
  USING (user_is_member_of_workspace(auth.uid(), workspace_id));

CREATE POLICY "service_manage_ai_usage_logs"
  ON public.ai_usage_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- -------- pending_ai_replies (service only) --------
CREATE POLICY "service_manage_pending_ai_replies"
  ON public.pending_ai_replies FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "workspace_members_read_pending_ai_replies"
  ON public.pending_ai_replies FOR SELECT
  USING (user_is_member_of_workspace(auth.uid(), workspace_id));

-- -------- profiles (user-owned, no workspace_id) --------
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- -------- user_roles (legacy compat) --------
CREATE POLICY "Authenticated can read user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

-- -------- workspaces (defined in migration 1, recreate here for safety) --------
CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT
  USING (
    user_is_member_of_workspace(auth.uid(), id)
    OR owner_id = auth.uid()
  );

CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their workspace"
  ON public.workspaces FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their workspace"
  ON public.workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- -------- workspace_members (defined in migration 1, recreate here for safety) --------
CREATE POLICY "Members can view members of their workspaces"
  ON public.workspace_members FOR SELECT
  USING (user_is_member_of_workspace(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage workspace members"
  ON public.workspace_members FOR ALL
  USING (user_workspace_role(auth.uid(), workspace_id) = 'admin')
  WITH CHECK (user_workspace_role(auth.uid(), workspace_id) = 'admin');
