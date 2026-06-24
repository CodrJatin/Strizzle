CREATE SCHEMA IF NOT EXISTS "auth";
--> statement-breakpoint
CREATE TYPE "public"."feed_weight" AS ENUM('priority', 'normal', 'muted');--> statement-breakpoint
CREATE TYPE "public"."hive_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('text', 'link', 'youtube', 'file', 'image');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('hive_joined', 'announcement_posted', 'task_assigned', 'mentioned', 'material_shared', 'deadline_added');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_source" AS ENUM('personal', 'hive_deadline', 'shelf_converted');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'done', 'blocked');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hive_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hive_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hive_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hive_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hive_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"token" text DEFAULT gen_random_uuid()::text NOT NULL,
	"role" "hive_role" DEFAULT 'member' NOT NULL,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hive_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "hive_material_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"hive_id" uuid NOT NULL,
	"shared_by" uuid NOT NULL,
	"folder_id" uuid,
	"shared_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hive_members" (
	"hive_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "hive_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hive_members_hive_id_user_id_pk" PRIMARY KEY("hive_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "hives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"course_code" text,
	"color_theme" text DEFAULT 'blue' NOT NULL,
	"feed_settings" jsonb DEFAULT '{"show_member_joins":true,"show_material_uploads":true,"show_task_completions":false,"show_syllabus_updates":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hives_name_check" CHECK (char_length("hives"."name") <= 100)
);
--> statement-breakpoint
CREATE TABLE "library_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"content_type" "material_type" NOT NULL,
	"title" text,
	"body" text,
	"url" text,
	"og_title" text,
	"og_description" text,
	"og_image" text,
	"og_domain" text,
	"storage_path" text,
	"storage_ref_id" text,
	"file_name" text,
	"file_size" bigint,
	"mime_type" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"search_vec" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"hive_id" uuid,
	"type" "notification_type" NOT NULL,
	"entity_id" uuid,
	"read_at" timestamp with time zone,
	"push_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh_key" text NOT NULL,
	"auth_key" text NOT NULL,
	"device_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "shelf_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_objects" (
	"ref_id" text PRIMARY KEY NOT NULL,
	"storage_path" text NOT NULL,
	"file_size" bigint NOT NULL,
	"mime_type" text NOT NULL,
	"ref_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_objects_storage_path_unique" UNIQUE("storage_path")
);
--> statement-breakpoint
CREATE TABLE "syllabus_progress" (
	"user_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "syllabus_progress_user_id_topic_id_pk" PRIMARY KEY("user_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "syllabus_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"hive_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"material_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"search_vec" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syllabus_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hive_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_material_refs" (
	"task_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	CONSTRAINT "task_material_refs_task_id_material_id_pk" PRIMARY KEY("task_id","material_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hive_id" uuid,
	"creator_id" uuid NOT NULL,
	"assignee_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"due_at" timestamp with time zone,
	"search_vec" "tsvector",
	"source" "task_source" DEFAULT 'personal' NOT NULL,
	"source_ref_id" uuid,
	"last_reminded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_title_check" CHECK (char_length("tasks"."title") <= 200)
);
--> statement-breakpoint
CREATE TABLE "user_hive_preferences" (
	"user_id" uuid NOT NULL,
	"hive_id" uuid NOT NULL,
	"feed_weight" "feed_weight" DEFAULT 'normal' NOT NULL,
	"last_visited_at" timestamp with time zone,
	CONSTRAINT "user_hive_preferences_user_id_hive_id_pk" PRIMARY KEY("user_id","hive_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" text DEFAULT 'default' NOT NULL,
	"default_cal_view" text DEFAULT 'week' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hive_invites" ADD CONSTRAINT "hive_invites_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hive_invites" ADD CONSTRAINT "hive_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hive_material_shares" ADD CONSTRAINT "hive_material_shares_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hive_material_shares" ADD CONSTRAINT "hive_material_shares_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hive_material_shares" ADD CONSTRAINT "hive_material_shares_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hive_material_shares" ADD CONSTRAINT "hive_material_shares_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hive_members" ADD CONSTRAINT "hive_members_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hive_members" ADD CONSTRAINT "hive_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hives" ADD CONSTRAINT "hives_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_materials" ADD CONSTRAINT "library_materials_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_materials" ADD CONSTRAINT "library_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_storage_ref_id_storage_objects_ref_id_fk" FOREIGN KEY ("storage_ref_id") REFERENCES "public"."storage_objects"("ref_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelf_items" ADD CONSTRAINT "shelf_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelf_items" ADD CONSTRAINT "shelf_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_topic_id_syllabus_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."syllabus_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_unit_id_syllabus_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."syllabus_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_units" ADD CONSTRAINT "syllabus_units_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_units" ADD CONSTRAINT "syllabus_units_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_material_refs" ADD CONSTRAINT "task_material_refs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_material_refs" ADD CONSTRAINT "task_material_refs_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hive_preferences" ADD CONSTRAINT "user_hive_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hive_preferences" ADD CONSTRAINT "user_hive_preferences_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_log_hive_created" ON "activity_log" USING btree ("hive_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_hive_material_shares_hive" ON "hive_material_shares" USING btree ("hive_id");--> statement-breakpoint
CREATE INDEX "idx_hive_material_shares_material" ON "hive_material_shares" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "idx_library_materials_user" ON "library_materials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_library_materials_starred" ON "library_materials" USING btree ("user_id") WHERE starred = true;--> statement-breakpoint
CREATE INDEX "idx_materials_search" ON "materials" USING gin ("search_vec");--> statement-breakpoint
CREATE INDEX "idx_materials_owner" ON "materials" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_materials_storage_ref" ON "materials" USING btree ("storage_ref_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_push_subscriptions_user" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_shelf_items_user" ON "shelf_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_syllabus_topics_search" ON "syllabus_topics" USING gin ("search_vec");--> statement-breakpoint
CREATE INDEX "idx_tasks_assignee" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_due_at" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_source_ref" ON "tasks" USING btree ("source_ref_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_search" ON "tasks" USING gin ("search_vec");--> statement-breakpoint
CREATE INDEX "idx_user_hive_preferences_user" ON "user_hive_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE FUNCTION update_materials_search_vec() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vec := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.body, '') || ' ' ||
    coalesce(NEW.og_title, '') || ' ' ||
    coalesce(NEW.og_description, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER materials_search_vec_update
  BEFORE INSERT OR UPDATE OF title, body, og_title, og_description, tags
  ON materials FOR EACH ROW
  EXECUTE FUNCTION update_materials_search_vec();--> statement-breakpoint
CREATE FUNCTION update_tasks_search_vec() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vec := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER tasks_search_vec_update
  BEFORE INSERT OR UPDATE OF title, description
  ON tasks FOR EACH ROW
  EXECUTE FUNCTION update_tasks_search_vec();--> statement-breakpoint
CREATE FUNCTION update_syllabus_topics_search_vec() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vec := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER syllabus_topics_search_vec_update
  BEFORE INSERT OR UPDATE OF title, description
  ON syllabus_topics FOR EACH ROW
  EXECUTE FUNCTION update_syllabus_topics_search_vec();--> statement-breakpoint
CREATE FUNCTION decrement_storage_ref_count() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.storage_ref_id IS NOT NULL THEN
    UPDATE storage_objects
    SET ref_count = ref_count - 1
    WHERE ref_id = OLD.storage_ref_id;

    -- If ref_count reaches 0, call Edge Function to delete the file
    IF (SELECT ref_count FROM storage_objects WHERE ref_id = OLD.storage_ref_id) = 0 THEN
      PERFORM net.http_post(
        url := current_setting('app.edge_function_url') || '/delete-storage-object',
        body := json_build_object('ref_id', OLD.storage_ref_id)::TEXT
      );
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER materials_storage_ref_cleanup
  AFTER DELETE ON materials FOR EACH ROW
  EXECUTE FUNCTION decrement_storage_ref_count();