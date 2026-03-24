-- Create storage bucket for audio messages
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-messages', 'audio-messages', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload audio
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-messages');

-- Allow public read access
CREATE POLICY "Public can read audio messages"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'audio-messages');