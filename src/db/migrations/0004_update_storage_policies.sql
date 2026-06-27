-- db/migrations/0004_update_storage_policies.sql

-- 1. Ensure the 'materials' bucket is set to public
UPDATE storage.buckets SET public = true WHERE id = 'materials';

-- 2. Drop the old authenticated-only select policy
DROP POLICY IF EXISTS "Allow authenticated select on materials" ON storage.objects;

-- 3. Drop existing public select policy if it exists to avoid duplicate/error
DROP POLICY IF EXISTS "Allow public select on materials" ON storage.objects;

-- 4. Create the new public select policy
CREATE POLICY "Allow public select on materials" ON storage.objects
  FOR SELECT USING (bucket_id = 'materials');
