ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE public.messages
ADD CONSTRAINT messages_message_type_check
CHECK (message_type = ANY (ARRAY['text'::text, 'image'::text, 'document'::text, 'audio'::text, 'video'::text]));