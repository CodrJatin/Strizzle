-- 0. Grant schema usage and table privileges to authenticated and anon roles
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated, anon;

-- 1. Create Security Definer Helper Functions
CREATE OR REPLACE FUNCTION public.get_hive_member_role(hive_uuid UUID, user_uuid UUID)
RETURNS public.hive_role SECURITY DEFINER AS $$
DECLARE
  user_role public.hive_role;
BEGIN
  SELECT role INTO user_role FROM public.hive_members
  WHERE hive_id = hive_uuid AND user_id = user_uuid;
  RETURN user_role;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_hive_member(hive_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.hive_members
    WHERE hive_id = hive_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- 2. Enable RLS on all 21 tables and apply policies

-- =========================================================
-- users
-- =========================================================
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_select" ON "users";
CREATE POLICY "users_select" ON "users" FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "users_insert" ON "users";
CREATE POLICY "users_insert" ON "users" FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "users_update" ON "users";
CREATE POLICY "users_update" ON "users" FOR UPDATE USING (id = auth.uid());
DROP POLICY IF EXISTS "users_delete" ON "users";
CREATE POLICY "users_delete" ON "users" FOR DELETE USING (id = auth.uid());

-- =========================================================
-- user_preferences
-- =========================================================
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_preferences_select" ON "user_preferences";
CREATE POLICY "user_preferences_select" ON "user_preferences" FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_preferences_insert" ON "user_preferences";
CREATE POLICY "user_preferences_insert" ON "user_preferences" FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_preferences_update" ON "user_preferences";
CREATE POLICY "user_preferences_update" ON "user_preferences" FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_preferences_delete" ON "user_preferences";
CREATE POLICY "user_preferences_delete" ON "user_preferences" FOR DELETE USING (user_id = auth.uid());

-- =========================================================
-- hives
-- =========================================================
ALTER TABLE "hives" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hives_select" ON "hives";
CREATE POLICY "hives_select" ON "hives" FOR SELECT USING (public.is_hive_member(id, auth.uid()));
DROP POLICY IF EXISTS "hives_insert" ON "hives";
CREATE POLICY "hives_insert" ON "hives" FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "hives_update" ON "hives";
CREATE POLICY "hives_update" ON "hives" FOR UPDATE USING (public.get_hive_member_role(id, auth.uid()) IN ('owner', 'admin'));
DROP POLICY IF EXISTS "hives_delete" ON "hives";
CREATE POLICY "hives_delete" ON "hives" FOR DELETE USING (owner_id = auth.uid());

-- =========================================================
-- hive_members
-- =========================================================
ALTER TABLE "hive_members" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hive_members_select" ON "hive_members";
CREATE POLICY "hive_members_select" ON "hive_members" FOR SELECT USING (public.is_hive_member(hive_id, auth.uid()));
DROP POLICY IF EXISTS "hive_members_insert" ON "hive_members";
CREATE POLICY "hive_members_insert" ON "hive_members" FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "hive_members_update" ON "hive_members";
CREATE POLICY "hive_members_update" ON "hive_members" FOR UPDATE USING (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin'));
DROP POLICY IF EXISTS "hive_members_delete" ON "hive_members";
CREATE POLICY "hive_members_delete" ON "hive_members" FOR DELETE USING (user_id = auth.uid() OR public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin'));

-- =========================================================
-- hive_invites
-- =========================================================
ALTER TABLE "hive_invites" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hive_invites_select" ON "hive_invites";
CREATE POLICY "hive_invites_select" ON "hive_invites" FOR SELECT USING (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin') OR auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "hive_invites_insert" ON "hive_invites";
CREATE POLICY "hive_invites_insert" ON "hive_invites" FOR INSERT WITH CHECK (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin') AND created_by = auth.uid());
DROP POLICY IF EXISTS "hive_invites_update" ON "hive_invites";
CREATE POLICY "hive_invites_update" ON "hive_invites" FOR UPDATE USING (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin'));
DROP POLICY IF EXISTS "hive_invites_delete" ON "hive_invites";
CREATE POLICY "hive_invites_delete" ON "hive_invites" FOR DELETE USING (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin'));

-- =========================================================
-- announcements
-- =========================================================
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_select" ON "announcements";
CREATE POLICY "announcements_select" ON "announcements" FOR SELECT USING (public.is_hive_member(hive_id, auth.uid()));
DROP POLICY IF EXISTS "announcements_insert" ON "announcements";
CREATE POLICY "announcements_insert" ON "announcements" FOR INSERT WITH CHECK (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin') AND author_id = auth.uid());
DROP POLICY IF EXISTS "announcements_update" ON "announcements";
CREATE POLICY "announcements_update" ON "announcements" FOR UPDATE USING (author_id = auth.uid() OR public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin'));
DROP POLICY IF EXISTS "announcements_delete" ON "announcements";
CREATE POLICY "announcements_delete" ON "announcements" FOR DELETE USING (author_id = auth.uid() OR public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin'));

-- =========================================================
-- activity_log
-- =========================================================
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_log_select" ON "activity_log";
CREATE POLICY "activity_log_select" ON "activity_log" FOR SELECT USING (public.is_hive_member(hive_id, auth.uid()));
DROP POLICY IF EXISTS "activity_log_insert" ON "activity_log";
CREATE POLICY "activity_log_insert" ON "activity_log" FOR INSERT WITH CHECK (actor_id = auth.uid() AND public.is_hive_member(hive_id, auth.uid()));
DROP POLICY IF EXISTS "activity_log_update" ON "activity_log";
CREATE POLICY "activity_log_update" ON "activity_log" FOR UPDATE USING (false);
DROP POLICY IF EXISTS "activity_log_delete" ON "activity_log";
CREATE POLICY "activity_log_delete" ON "activity_log" FOR DELETE USING (false);

-- =========================================================
-- notifications
-- =========================================================
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select" ON "notifications";
CREATE POLICY "notifications_select" ON "notifications" FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_insert" ON "notifications";
CREATE POLICY "notifications_insert" ON "notifications" FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update" ON "notifications";
CREATE POLICY "notifications_update" ON "notifications" FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_delete" ON "notifications";
CREATE POLICY "notifications_delete" ON "notifications" FOR DELETE USING (user_id = auth.uid());

-- =========================================================
-- storage_objects
-- =========================================================
ALTER TABLE "storage_objects" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "storage_objects_select" ON "storage_objects";
CREATE POLICY "storage_objects_select" ON "storage_objects" FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "storage_objects_insert" ON "storage_objects";
CREATE POLICY "storage_objects_insert" ON "storage_objects" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "storage_objects_update" ON "storage_objects";
CREATE POLICY "storage_objects_update" ON "storage_objects" FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "storage_objects_delete" ON "storage_objects";
CREATE POLICY "storage_objects_delete" ON "storage_objects" FOR DELETE USING (false);

-- =========================================================
-- materials
-- =========================================================
ALTER TABLE "materials" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "materials_select" ON "materials";
CREATE POLICY "materials_select" ON "materials" FOR SELECT USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.hive_material_shares hms WHERE hms.material_id = materials.id AND public.is_hive_member(hms.hive_id, auth.uid())));
DROP POLICY IF EXISTS "materials_insert" ON "materials";
CREATE POLICY "materials_insert" ON "materials" FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "materials_update" ON "materials";
CREATE POLICY "materials_update" ON "materials" FOR UPDATE USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "materials_delete" ON "materials";
CREATE POLICY "materials_delete" ON "materials" FOR DELETE USING (owner_id = auth.uid());

-- =========================================================
-- shelf_items
-- =========================================================
ALTER TABLE "shelf_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shelf_items_select" ON "shelf_items";
CREATE POLICY "shelf_items_select" ON "shelf_items" FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "shelf_items_insert" ON "shelf_items";
CREATE POLICY "shelf_items_insert" ON "shelf_items" FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "shelf_items_update" ON "shelf_items";
CREATE POLICY "shelf_items_update" ON "shelf_items" FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "shelf_items_delete" ON "shelf_items";
CREATE POLICY "shelf_items_delete" ON "shelf_items" FOR DELETE USING (user_id = auth.uid());

-- =========================================================
-- library_materials
-- =========================================================
ALTER TABLE "library_materials" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "library_materials_select" ON "library_materials";
CREATE POLICY "library_materials_select" ON "library_materials" FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "library_materials_insert" ON "library_materials";
CREATE POLICY "library_materials_insert" ON "library_materials" FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "library_materials_update" ON "library_materials";
CREATE POLICY "library_materials_update" ON "library_materials" FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "library_materials_delete" ON "library_materials";
CREATE POLICY "library_materials_delete" ON "library_materials" FOR DELETE USING (user_id = auth.uid());

-- =========================================================
-- folders
-- =========================================================
ALTER TABLE "folders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "folders_select" ON "folders";
CREATE POLICY "folders_select" ON "folders" FOR SELECT USING (public.is_hive_member(hive_id, auth.uid()));
DROP POLICY IF EXISTS "folders_insert" ON "folders";
CREATE POLICY "folders_insert" ON "folders" FOR INSERT WITH CHECK (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member') AND created_by = auth.uid());
DROP POLICY IF EXISTS "folders_update" ON "folders";
CREATE POLICY "folders_update" ON "folders" FOR UPDATE USING (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member'));
DROP POLICY IF EXISTS "folders_delete" ON "folders";
CREATE POLICY "folders_delete" ON "folders" FOR DELETE USING (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member'));

-- =========================================================
-- hive_material_shares
-- =========================================================
ALTER TABLE "hive_material_shares" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hive_material_shares_select" ON "hive_material_shares";
CREATE POLICY "hive_material_shares_select" ON "hive_material_shares" FOR SELECT USING (public.is_hive_member(hive_id, auth.uid()));
DROP POLICY IF EXISTS "hive_material_shares_insert" ON "hive_material_shares";
CREATE POLICY "hive_material_shares_insert" ON "hive_material_shares" FOR INSERT WITH CHECK (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member') AND shared_by = auth.uid());
DROP POLICY IF EXISTS "hive_material_shares_update" ON "hive_material_shares";
CREATE POLICY "hive_material_shares_update" ON "hive_material_shares" FOR UPDATE USING (shared_by = auth.uid() OR public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin'));
DROP POLICY IF EXISTS "hive_material_shares_delete" ON "hive_material_shares";
CREATE POLICY "hive_material_shares_delete" ON "hive_material_shares" FOR DELETE USING (shared_by = auth.uid() OR public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin'));

-- =========================================================
-- tasks
-- =========================================================
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_select" ON "tasks";
CREATE POLICY "tasks_select" ON "tasks" FOR SELECT USING ((hive_id IS NULL AND (creator_id = auth.uid() OR assignee_id = auth.uid())) OR (hive_id IS NOT NULL AND public.is_hive_member(hive_id, auth.uid())));
DROP POLICY IF EXISTS "tasks_insert" ON "tasks";
CREATE POLICY "tasks_insert" ON "tasks" FOR INSERT WITH CHECK ((hive_id IS NULL AND creator_id = auth.uid()) OR (hive_id IS NOT NULL AND public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member') AND creator_id = auth.uid()));
DROP POLICY IF EXISTS "tasks_update" ON "tasks";
CREATE POLICY "tasks_update" ON "tasks" FOR UPDATE USING ((hive_id IS NULL AND (creator_id = auth.uid() OR assignee_id = auth.uid())) OR (hive_id IS NOT NULL AND public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member')));
DROP POLICY IF EXISTS "tasks_delete" ON "tasks";
CREATE POLICY "tasks_delete" ON "tasks" FOR DELETE USING ((hive_id IS NULL AND creator_id = auth.uid()) OR (hive_id IS NOT NULL AND (creator_id = auth.uid() OR public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin'))));

-- =========================================================
-- task_material_refs
-- =========================================================
ALTER TABLE "task_material_refs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_material_refs_select" ON "task_material_refs";
CREATE POLICY "task_material_refs_select" ON "task_material_refs" FOR SELECT USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_material_refs.task_id));
DROP POLICY IF EXISTS "task_material_refs_insert" ON "task_material_refs";
CREATE POLICY "task_material_refs_insert" ON "task_material_refs" FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_material_refs.task_id));
DROP POLICY IF EXISTS "task_material_refs_update" ON "task_material_refs";
CREATE POLICY "task_material_refs_update" ON "task_material_refs" FOR UPDATE USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_material_refs.task_id));
DROP POLICY IF EXISTS "task_material_refs_delete" ON "task_material_refs";
CREATE POLICY "task_material_refs_delete" ON "task_material_refs" FOR DELETE USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_material_refs.task_id));

-- =========================================================
-- syllabus_units
-- =========================================================
ALTER TABLE "syllabus_units" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syllabus_units_select" ON "syllabus_units";
CREATE POLICY "syllabus_units_select" ON "syllabus_units" FOR SELECT USING (public.is_hive_member(hive_id, auth.uid()));
DROP POLICY IF EXISTS "syllabus_units_insert" ON "syllabus_units";
CREATE POLICY "syllabus_units_insert" ON "syllabus_units" FOR INSERT WITH CHECK (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member') AND created_by = auth.uid());
DROP POLICY IF EXISTS "syllabus_units_update" ON "syllabus_units";
CREATE POLICY "syllabus_units_update" ON "syllabus_units" FOR UPDATE USING (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member'));
DROP POLICY IF EXISTS "syllabus_units_delete" ON "syllabus_units";
CREATE POLICY "syllabus_units_delete" ON "syllabus_units" FOR DELETE USING (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member'));

-- =========================================================
-- syllabus_topics
-- =========================================================
ALTER TABLE "syllabus_topics" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syllabus_topics_select" ON "syllabus_topics";
CREATE POLICY "syllabus_topics_select" ON "syllabus_topics" FOR SELECT USING (public.is_hive_member(hive_id, auth.uid()));
DROP POLICY IF EXISTS "syllabus_topics_insert" ON "syllabus_topics";
CREATE POLICY "syllabus_topics_insert" ON "syllabus_topics" FOR INSERT WITH CHECK (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member'));
DROP POLICY IF EXISTS "syllabus_topics_update" ON "syllabus_topics";
CREATE POLICY "syllabus_topics_update" ON "syllabus_topics" FOR UPDATE USING (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member'));
DROP POLICY IF EXISTS "syllabus_topics_delete" ON "syllabus_topics";
CREATE POLICY "syllabus_topics_delete" ON "syllabus_topics" FOR DELETE USING (public.get_hive_member_role(hive_id, auth.uid()) IN ('owner', 'admin', 'member'));

-- =========================================================
-- syllabus_progress
-- =========================================================
ALTER TABLE "syllabus_progress" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syllabus_progress_select" ON "syllabus_progress";
CREATE POLICY "syllabus_progress_select" ON "syllabus_progress" FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.syllabus_topics t WHERE t.id = syllabus_progress.topic_id AND public.is_hive_member(t.hive_id, auth.uid())));
DROP POLICY IF EXISTS "syllabus_progress_insert" ON "syllabus_progress";
CREATE POLICY "syllabus_progress_insert" ON "syllabus_progress" FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "syllabus_progress_update" ON "syllabus_progress";
CREATE POLICY "syllabus_progress_update" ON "syllabus_progress" FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "syllabus_progress_delete" ON "syllabus_progress";
CREATE POLICY "syllabus_progress_delete" ON "syllabus_progress" FOR DELETE USING (user_id = auth.uid());

-- =========================================================
-- push_subscriptions
-- =========================================================
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_select" ON "push_subscriptions";
CREATE POLICY "push_subscriptions_select" ON "push_subscriptions" FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "push_subscriptions_insert" ON "push_subscriptions";
CREATE POLICY "push_subscriptions_insert" ON "push_subscriptions" FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "push_subscriptions_update" ON "push_subscriptions";
CREATE POLICY "push_subscriptions_update" ON "push_subscriptions" FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "push_subscriptions_delete" ON "push_subscriptions";
CREATE POLICY "push_subscriptions_delete" ON "push_subscriptions" FOR DELETE USING (user_id = auth.uid());

-- =========================================================
-- user_hive_preferences
-- =========================================================
ALTER TABLE "user_hive_preferences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_hive_preferences_select" ON "user_hive_preferences";
CREATE POLICY "user_hive_preferences_select" ON "user_hive_preferences" FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_hive_preferences_insert" ON "user_hive_preferences";
CREATE POLICY "user_hive_preferences_insert" ON "user_hive_preferences" FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_hive_preferences_update" ON "user_hive_preferences";
CREATE POLICY "user_hive_preferences_update" ON "user_hive_preferences" FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_hive_preferences_delete" ON "user_hive_preferences";
CREATE POLICY "user_hive_preferences_delete" ON "user_hive_preferences" FOR DELETE USING (user_id = auth.uid());
