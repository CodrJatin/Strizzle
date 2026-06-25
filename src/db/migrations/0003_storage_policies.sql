-- ==========================================
-- Avatars Bucket Policies
-- ==========================================

-- Allow public read access to avatars
DROP POLICY IF EXISTS "Allow public select on avatars" ON storage.objects;
CREATE POLICY "Allow public select on avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated users to upload avatars to a folder matching their user ID
DROP POLICY IF EXISTS "Allow authenticated insert on avatars" ON storage.objects;
CREATE POLICY "Allow authenticated insert on avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own avatars
DROP POLICY IF EXISTS "Allow authenticated update on avatars" ON storage.objects;
CREATE POLICY "Allow authenticated update on avatars" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own avatars
DROP POLICY IF EXISTS "Allow authenticated delete on avatars" ON storage.objects;
CREATE POLICY "Allow authenticated delete on avatars" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==========================================
-- Materials Bucket Policies
-- ==========================================

-- Allow authenticated users to view materials
DROP POLICY IF EXISTS "Allow authenticated select on materials" ON storage.objects;
CREATE POLICY "Allow authenticated select on materials" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'materials');

-- Allow authenticated users to upload materials
DROP POLICY IF EXISTS "Allow authenticated insert on materials" ON storage.objects;
CREATE POLICY "Allow authenticated insert on materials" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'materials');
