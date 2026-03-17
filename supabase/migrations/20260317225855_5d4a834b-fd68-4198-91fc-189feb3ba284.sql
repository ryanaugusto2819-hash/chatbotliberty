
CREATE TABLE public.knowledge_base_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'text',
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  file_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on knowledge_base_items" ON public.knowledge_base_items
  FOR ALL TO public USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-base', 'knowledge-base', true);

CREATE POLICY "Allow public read on knowledge-base" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'knowledge-base');

CREATE POLICY "Allow authenticated upload to knowledge-base" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'knowledge-base');

CREATE POLICY "Allow authenticated delete on knowledge-base" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'knowledge-base');
