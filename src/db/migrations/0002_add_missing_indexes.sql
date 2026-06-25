-- hives lookup by owner
CREATE INDEX IF NOT EXISTS idx_hives_owner_id ON public.hives(owner_id);

-- hive_members reverse lookup
CREATE INDEX IF NOT EXISTS idx_hive_members_user_id ON public.hive_members(user_id);

-- invites lookup by hive
CREATE INDEX IF NOT EXISTS idx_hive_invites_hive_id ON public.hive_invites(hive_id);

-- announcements lookup by hive
CREATE INDEX IF NOT EXISTS idx_announcements_hive_id ON public.announcements(hive_id);

-- folders lookup by hive and parent folder
CREATE INDEX IF NOT EXISTS idx_folders_hive_id ON public.folders(hive_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);

-- syllabus units lookup by hive
CREATE INDEX IF NOT EXISTS idx_syllabus_units_hive_id ON public.syllabus_units(hive_id);

-- syllabus topics lookup by unit and hive
CREATE INDEX IF NOT EXISTS idx_syllabus_topics_unit_id ON public.syllabus_topics(unit_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_topics_hive_id ON public.syllabus_topics(hive_id);

-- syllabus progress reverse lookup
CREATE INDEX IF NOT EXISTS idx_syllabus_progress_topic_id ON public.syllabus_progress(topic_id);

-- user_hive_preferences reverse lookup
CREATE INDEX IF NOT EXISTS idx_user_hive_preferences_hive_id ON public.user_hive_preferences(hive_id);
