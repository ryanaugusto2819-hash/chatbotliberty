ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;

ALTER TABLE public.messages
ADD CONSTRAINT messages_status_check
CHECK (
  status = ANY (ARRAY[
    'pending'::text,
    'failed'::text,
    'sent'::text,
    'delivered'::text,
    'read'::text
  ])
);