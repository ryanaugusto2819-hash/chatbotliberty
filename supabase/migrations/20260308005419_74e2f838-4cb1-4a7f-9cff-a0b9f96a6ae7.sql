
-- Conversations table
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_avatar text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'pending', 'active', 'resolved')),
  assigned_agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  content text NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'agent', 'bot')),
  sender_agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Updated_at trigger for conversations
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all conversations and messages
CREATE POLICY "Authenticated users can view conversations"
  ON public.conversations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert conversations"
  ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update conversations"
  ON public.conversations FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view messages"
  ON public.messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert messages"
  ON public.messages FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Indexes
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_assigned_agent ON public.conversations(assigned_agent_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at);
