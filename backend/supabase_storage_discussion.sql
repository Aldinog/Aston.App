-- Create the storage bucket 'discussion-images'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('discussion-images', 'discussion-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for the bucket
-- 1. Allow public access to view files
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'discussion-images' );

-- 2. Allow authenticated users to upload files
CREATE POLICY "Authenticated Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'discussion-images' AND auth.role() = 'authenticated' );

-- 3. Allow users to update/delete their own files (Optional)
CREATE POLICY "Owner Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'discussion-images' AND auth.uid() = owner );
