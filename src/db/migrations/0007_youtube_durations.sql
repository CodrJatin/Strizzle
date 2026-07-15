-- Add YouTube columns to materials table
ALTER TABLE "materials" ADD COLUMN "yt_playlist_id" text;
ALTER TABLE "materials" ADD COLUMN "yt_duration" integer;
ALTER TABLE "materials" ADD COLUMN "yt_video_range" text;

-- Create youtube_playlist_videos table
CREATE TABLE IF NOT EXISTS "youtube_playlist_videos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "material_id" uuid NOT NULL REFERENCES "materials"("id") ON DELETE CASCADE,
  "video_id" text NOT NULL,
  "title" text NOT NULL,
  "duration" integer NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on youtube_playlist_videos
ALTER TABLE "youtube_playlist_videos" ENABLE ROW LEVEL SECURITY;

-- Write policies matching parents in materials table
CREATE POLICY "yt_videos_select" ON "youtube_playlist_videos"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_id AND (
        m.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.hive_material_shares hms
          WHERE hms.material_id = m.id AND public.is_hive_member(hms.hive_id, auth.uid())
        )
      )
    )
  );

CREATE POLICY "yt_videos_insert" ON "youtube_playlist_videos"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_id AND m.owner_id = auth.uid()
    )
  );

CREATE POLICY "yt_videos_update" ON "youtube_playlist_videos"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_id AND m.owner_id = auth.uid()
    )
  );

CREATE POLICY "yt_videos_delete" ON "youtube_playlist_videos"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_id AND m.owner_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_yt_playlist_videos_material_id" ON "youtube_playlist_videos"("material_id");
CREATE INDEX IF NOT EXISTS "idx_yt_playlist_videos_position" ON "youtube_playlist_videos"("material_id", "position");
