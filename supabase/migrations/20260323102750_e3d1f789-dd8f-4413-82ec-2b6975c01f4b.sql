ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
ADD COLUMN IF NOT EXISTS provider_status TEXT,
ADD COLUMN IF NOT EXISTS provider_error TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id
ON public.messages (provider_message_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_provider_status
ON public.messages (conversation_id, provider_status);