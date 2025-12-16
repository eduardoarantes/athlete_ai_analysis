-- Create storage bucket for FIT files
INSERT INTO storage.buckets (id, name, public)
VALUES ('fit-files', 'fit-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS is already enabled on storage.objects by default

-- Policy: Users can view their own FIT files
DROP POLICY IF EXISTS "Users can view their own FIT files" ON storage.objects;
CREATE POLICY "Users can view their own FIT files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fit-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can upload their own FIT files
DROP POLICY IF EXISTS "Users can upload their own FIT files" ON storage.objects;
CREATE POLICY "Users can upload their own FIT files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fit-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own FIT files
DROP POLICY IF EXISTS "Users can update their own FIT files" ON storage.objects;
CREATE POLICY "Users can update their own FIT files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'fit-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own FIT files
DROP POLICY IF EXISTS "Users can delete their own FIT files" ON storage.objects;
CREATE POLICY "Users can delete their own FIT files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'fit-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
