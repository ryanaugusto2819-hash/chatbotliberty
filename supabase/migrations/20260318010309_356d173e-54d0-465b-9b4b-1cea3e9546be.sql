
DROP FUNCTION public.get_conversations_with_last_message();

CREATE OR REPLACE FUNCTION public.get_conversations_with_last_message()
 RETURNS TABLE(id uuid, contact_name text, contact_phone text, status text, tags text[], updated_at timestamp with time zone, assigned_agent_id uuid, last_message text, unread_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    c.id,
    c.contact_name,
    c.contact_phone,
    c.status,
    c.tags,
    c.updated_at,
    c.assigned_agent_id,
    (
      SELECT m.content 
      FROM messages m 
      WHERE m.conversation_id = c.id 
      ORDER BY m.created_at DESC 
      LIMIT 1
    ) as last_message,
    (
      SELECT COUNT(*)
      FROM messages m
      WHERE m.conversation_id = c.id
        AND m.sender_type = 'customer'
        AND m.status != 'read'
    ) as unread_count
  FROM conversations c
  WHERE c.contact_phone NOT LIKE '%-group'
  ORDER BY c.updated_at DESC;
$$;

CREATE POLICY "Authenticated users can update messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
