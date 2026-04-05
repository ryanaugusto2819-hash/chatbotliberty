-- ============================================================
-- MIGRATION: Multi-Tenant Foundation
-- Creates workspaces, workspace_members tables and RLS helper
-- ============================================================

-- 1. Workspaces table (root tenant entity)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan        TEXT        NOT NULL DEFAULT 'starter',
  max_agents  INT         NOT NULL DEFAULT 5,
  max_connections INT     NOT NULL DEFAULT 3,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces (owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces (slug);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 2. Workspace members table (per-workspace role assignment)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         app_role    NOT NULL DEFAULT 'agent',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members (workspace_id);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 3. RLS security helper function (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.user_is_member_of_workspace(
  p_user_id    UUID,
  p_workspace_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.workspace_members
    WHERE  user_id      = p_user_id
      AND  workspace_id = p_workspace_id
      AND  is_active    = true
  );
$$;

-- Helper: get user's role inside a workspace
CREATE OR REPLACE FUNCTION public.user_workspace_role(
  p_user_id    UUID,
  p_workspace_id UUID
)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM   public.workspace_members
  WHERE  user_id      = p_user_id
    AND  workspace_id = p_workspace_id
    AND  is_active    = true
  LIMIT 1;
$$;

-- 4. RLS policies for workspaces
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

-- 5. RLS policies for workspace_members
CREATE POLICY "Members can view members of their workspaces"
  ON public.workspace_members FOR SELECT
  USING (user_is_member_of_workspace(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage workspace members"
  ON public.workspace_members FOR ALL
  USING (
    user_workspace_role(auth.uid(), workspace_id) = 'admin'
  )
  WITH CHECK (
    user_workspace_role(auth.uid(), workspace_id) = 'admin'
  );

-- 6. Auto-updated_at trigger for workspaces
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
$func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$;

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Auto-add owner as admin member when workspace is created
CREATE OR REPLACE FUNCTION public.add_owner_as_workspace_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS
$func$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'admin')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER workspace_add_owner_as_admin
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_workspace_admin();
