-- ============================================================
-- MIGRATION: Update RPCs to be workspace-scoped
-- ============================================================

-- Drop old versions first
DROP FUNCTION IF EXISTS public.get_conversations_with_last_message();
DROP FUNCTION IF EXISTS public.get_inbox_page(uuid, uuid[], boolean, integer, integer, boolean, text, text, uuid);

-- -------- get_conversations_with_last_message (now requires workspace_id) --------
CREATE OR REPLACE FUNCTION public.get_conversations_with_last_message(
  p_workspace_id UUID
)
RETURNS TABLE (
  id                   UUID,
  contact_name         TEXT,
  contact_phone        TEXT,
  status               TEXT,
  updated_at           TIMESTAMPTZ,
  niche_id             UUID,
  connection_config_id UUID,
  assigned_agent_id    UUID,
  last_message         TEXT,
  last_message_sender  TEXT,
  unread_count         BIGINT,
  tags                 TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.contact_name,
    c.contact_phone,
    c.status,
    c.updated_at,
    c.niche_id,
    c.connection_config_id,
    c.assigned_agent_id,
    m.content                                          AS last_message,
    m.sender_type                                      AS last_message_sender,
    COUNT(m2.id) FILTER (WHERE m2.is_read = false AND m2.sender_type = 'customer') AS unread_count,
    ARRAY(
      SELECT t.name
      FROM   contact_tags ct
      JOIN   tags t ON t.id = ct.tag_id
      WHERE  ct.conversation_id = c.id
        AND  ct.workspace_id = p_workspace_id
    ) AS tags
  FROM conversations c
  LEFT JOIN LATERAL (
    SELECT content, sender_type
    FROM   messages
    WHERE  conversation_id = c.id
    ORDER  BY created_at DESC
    LIMIT  1
  ) m ON true
  LEFT JOIN messages m2 ON m2.conversation_id = c.id
  WHERE c.workspace_id = p_workspace_id
    AND user_is_member_of_workspace(auth.uid(), p_workspace_id)
  GROUP BY c.id, c.contact_name, c.contact_phone, c.status, c.updated_at,
           c.niche_id, c.connection_config_id, c.assigned_agent_id,
           m.content, m.sender_type
  ORDER BY c.updated_at DESC;
$$;

-- -------- get_inbox_page (now requires p_workspace_id) --------
CREATE OR REPLACE FUNCTION public.get_inbox_page(
  p_workspace_id   UUID,
  p_agent_id       UUID       DEFAULT NULL,
  p_connection_ids UUID[]     DEFAULT NULL,
  p_last_customer  BOOLEAN    DEFAULT NULL,
  p_limit          INT        DEFAULT 25,
  p_offset         INT        DEFAULT 0,
  p_only_unread    BOOLEAN    DEFAULT false,
  p_search         TEXT       DEFAULT NULL,
  p_status         TEXT       DEFAULT NULL,
  p_tag_id         UUID       DEFAULT NULL
)
RETURNS TABLE (
  id                   UUID,
  contact_name         TEXT,
  contact_phone        TEXT,
  status               TEXT,
  updated_at           TIMESTAMPTZ,
  niche_id             UUID,
  connection_config_id UUID,
  assigned_agent_id    UUID,
  last_message         TEXT,
  last_message_sender  TEXT,
  unread_count         BIGINT,
  contact_tags         JSON,
  tags                 TEXT[],
  total_count          BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      c.id,
      c.contact_name,
      c.contact_phone,
      c.status,
      c.updated_at,
      c.niche_id,
      c.connection_config_id,
      c.assigned_agent_id,
      m.content                                                             AS last_message,
      m.sender_type                                                         AS last_message_sender,
      COUNT(m2.id) FILTER (WHERE m2.is_read = false AND m2.sender_type = 'customer') AS unread_count,
      (
        SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
        FROM   contact_tags ct
        JOIN   tags t ON t.id = ct.tag_id
        WHERE  ct.conversation_id = c.id
          AND  ct.workspace_id = p_workspace_id
      ) AS contact_tags,
      ARRAY(
        SELECT t.name
        FROM   contact_tags ct
        JOIN   tags t ON t.id = ct.tag_id
        WHERE  ct.conversation_id = c.id
          AND  ct.workspace_id = p_workspace_id
      ) AS tags
    FROM conversations c
    LEFT JOIN LATERAL (
      SELECT content, sender_type
      FROM   messages
      WHERE  conversation_id = c.id
      ORDER  BY created_at DESC
      LIMIT  1
    ) m ON true
    LEFT JOIN messages m2 ON m2.conversation_id = c.id
    WHERE
      c.workspace_id = p_workspace_id
      AND user_is_member_of_workspace(auth.uid(), p_workspace_id)
      AND (p_agent_id       IS NULL OR c.assigned_agent_id = p_agent_id)
      AND (p_connection_ids IS NULL OR c.connection_config_id = ANY(p_connection_ids))
      AND (p_status         IS NULL OR c.status = p_status)
      AND (p_search         IS NULL OR c.contact_name ILIKE '%' || p_search || '%'
                                     OR c.contact_phone ILIKE '%' || p_search || '%')
      AND (p_tag_id IS NULL OR EXISTS (
        SELECT 1 FROM contact_tags ct2
        WHERE ct2.conversation_id = c.id
          AND ct2.tag_id = p_tag_id
          AND ct2.workspace_id = p_workspace_id
      ))
    GROUP BY c.id, c.contact_name, c.contact_phone, c.status, c.updated_at,
             c.niche_id, c.connection_config_id, c.assigned_agent_id,
             m.content, m.sender_type
    HAVING (p_only_unread = false OR COUNT(m2.id) FILTER (WHERE m2.is_read = false AND m2.sender_type = 'customer') > 0)
  )
  SELECT
    b.*,
    COUNT(*) OVER() AS total_count
  FROM base b
  ORDER BY b.updated_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;
