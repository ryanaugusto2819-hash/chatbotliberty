
CREATE TABLE public.quick_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text',
  audio_url TEXT,
  shortcut TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on quick_messages" ON public.quick_messages FOR ALL USING (true) WITH CHECK (true);
