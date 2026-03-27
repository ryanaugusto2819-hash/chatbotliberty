
ALTER TABLE public.follow_up_templates ADD COLUMN image_url TEXT DEFAULT NULL;

-- Create storage bucket for follow-up images
INSERT INTO storage.buckets (id, name, public) VALUES ('follow-up-images', 'follow-up-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload follow-up images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'follow-up-images');

-- Allow public read
CREATE POLICY "Public read follow-up images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'follow-up-images');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete follow-up images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'follow-up-images');
