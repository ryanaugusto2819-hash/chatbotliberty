
CREATE OR REPLACE FUNCTION public.get_inbox_page(
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT '',
  p_status text DEFAULT '',
  p_agent_id uuid DEFAULT NULL,
  p_connection_ids uuid[] DEFAULT NULL,
  p_tag_id uuid DEFAULT NULL,
  p_only_unread boolean DEFAULT false,
  p_last_customer boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  contact_name text,
  contact_phone text,
  status text,
  tags text[],
  updated_at timestamptz,
  assigned_agent_id uuid,
  last_message text,
  last_message_sender text,
  unread_count bigint,
  niche_id uuid,
  connection_config_id uuid,
  contact_tags jsonb,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH filtered_convos AS (
    SELECT c.id, c.contact_name, c.contact_phone, c.status, c.tags,
           c.updated_at, c.assigned_agent_id, c.niche_id, c.connection_config_id
    FROM conversations c
    WHERE c.contact_phone NOT LIKE '%-group'
      AND (p_search = '' OR c.contact_name ILIKE '%' || p_search || '%' OR c.contact_phone ILIKE '%' || p_search || '%')
      AND (p_status = '' OR c.status = p_status)
      AND (p_agent_id IS NULL OR c.assigned_agent_id = p_agent_id)
      AND (p_connection_ids IS NULL OR c.connection_config_id = ANY(p_connection_ids))
      AND (p_tag_id IS NULL OR EXISTS (
        SELECT 1 FROM contact_tags ct WHERE ct.contact_phone = c.contact_phone AND ct.tag_id = p_tag_id
      ))
  ),
  with_messages AS (
    SELECT
      fc.*,
      lm.content as last_message,
      lm.sender_type as last_message_sender,
      lm.created_at as last_message_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = fc.id AND m.sender_type = 'customer' AND m.status != 'read') as unread_count
    FROM filtered_convos fc
    LEFT JOIN LATERAL (
      SELECT m.content, m.sender_type, m.created_at
      FROM messages m
      WHERE m.conversation_id = fc.id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) lm ON true
  ),
  post_filtered AS (
    SELECT wm.*
    FROM with_messages wm
    WHERE (NOT p_only_unread OR wm.unread_count > 0)
      AND (NOT p_last_customer OR wm.last_message_sender = 'customer')
  ),
  counted AS (
    SELECT COUNT(*)::bigint as cnt FROM post_filtered
  ),
  paged AS (
    SELECT pf.*
    FROM post_filtered pf
    ORDER BY COALESCE(pf.last_message_at, pf.updated_at) DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    pg.id,
    pg.contact_name,
    pg.contact_phone,
    pg.status,
    pg.tags,
    COALESCE(pg.last_message_at, pg.updated_at) as updated_at,
    pg.assigned_agent_id,
    pg.last_message,
    pg.last_message_sender,
    pg.unread_count,
    pg.niche_id,
    pg.connection_config_id,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', ct.id, 'tag_id', t.id, 'name', t.name, 'color', t.color))
       FROM contact_tags ct JOIN tags t ON t.id = ct.tag_id
       WHERE ct.contact_phone = pg.contact_phone),
      '[]'::jsonb
    ) as contact_tags,
    (SELECT cnt FROM counted) as total_count
  FROM paged pg
  ORDER BY COALESCE(pg.last_message_at, pg.updated_at) DESC;
$function$;
