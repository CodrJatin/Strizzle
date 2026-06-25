# strizzle — Database Schema

> 22 tables · 7 enums · Supabase Postgres + Drizzle ORM  
> Every table has RLS enabled. No exceptions.

---

## Enums

```sql
-- hive_role: role of a user within a hive
CREATE TYPE hive_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- material_type: content type of a material
CREATE TYPE material_type AS ENUM ('text', 'link', 'youtube', 'file', 'image');

-- task_status
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'blocked');

-- task_priority
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- task_source: how a task was created
CREATE TYPE task_source AS ENUM ('personal', 'hive_deadline', 'shelf_converted');

-- feed_weight: per-hive feed preference
CREATE TYPE feed_weight AS ENUM ('priority', 'normal', 'muted');

-- notification_type
CREATE TYPE notification_type AS ENUM (
  'hive_joined', 'announcement_posted', 'task_assigned',
  'mentioned', 'material_shared', 'deadline_added'
);
```

---

## Core Tables

### users
Extends Supabase `auth.users`. One row per authenticated user.

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- Policy: user can only SELECT/UPDATE their own row (id = auth.uid())
```

---

### user_preferences
One row per user. Created during onboarding. Stores app-wide settings including theme.

```sql
CREATE TABLE user_preferences (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme            TEXT NOT NULL DEFAULT 'default',
  default_cal_view TEXT NOT NULL DEFAULT 'week', -- week | day | month
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
-- Policy: user_id = auth.uid() for SELECT/UPDATE
```

---

### hives
The core workspace entity. One hive per course or subject.

```sql
CREATE TABLE hives (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES users(id),
  name         TEXT NOT NULL CHECK (char_length(name) <= 100),
  description  TEXT,
  course_code  TEXT,
  color_theme  TEXT NOT NULL DEFAULT 'blue',
  feed_settings JSONB NOT NULL DEFAULT '{
    "show_member_joins": true,
    "show_material_uploads": true,
    "show_task_completions": false,
    "show_syllabus_updates": true
  }',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hives ENABLE ROW LEVEL SECURITY;
-- SELECT: user is a member (hive_id in hive_members for auth.uid())
-- UPDATE: owner_id = auth.uid() OR user has admin role
-- DELETE: owner_id = auth.uid()
```

---

### hive_members
Role per user per hive. Composite primary key.

```sql
CREATE TABLE hive_members (
  hive_id    UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       hive_role NOT NULL DEFAULT 'member',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hive_id, user_id)
);

ALTER TABLE hive_members ENABLE ROW LEVEL SECURITY;
-- SELECT: user shares a hive_id with the row (same hive member)
-- INSERT: only via invite acceptance flow (service role)
-- UPDATE role: admin+ in the hive
-- DELETE: admin+ in the hive OR self-removal
```

---

### hive_invites
Invite tokens with expiry, use count, and revocation support.

```sql
CREATE TABLE hive_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hive_id     UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id),
  token       TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  role        hive_role NOT NULL DEFAULT 'member',
  expires_at  TIMESTAMPTZ,
  max_uses    INT,
  use_count   INT NOT NULL DEFAULT 0,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hive_invites ENABLE ROW LEVEL SECURITY;
-- SELECT: admin+ in the hive, OR public select by token for /invite/[token] page
-- INSERT: admin+ in the hive
-- UPDATE: admin+ in the hive (for revocation)
```

---

### announcements

```sql
CREATE TABLE announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hive_id    UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
-- SELECT: hive members
-- INSERT: admin+ in the hive
-- DELETE: author OR admin+
```

---

### activity_log
Event log powering hive feed and shared feed.

```sql
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hive_id     UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_hive_created ON activity_log(hive_id, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
-- SELECT: hive members
-- INSERT: service role only (written by tRPC procedures)
```

---

### notifications
In-app and push notification records.

```sql
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hive_id    UUID REFERENCES hives(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  entity_id  UUID,
  read_at    TIMESTAMPTZ,
  push_sent  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- All operations: user_id = auth.uid()
```

---

## Material System Tables

> **Architecture:** Every material is owned by exactly one user. Ownership never changes.  
> A material exists in one or more *location tables* that track where it appears.  
> Deleting a material never cascades to `hive_material_shares` or other users' copies.

---

### materials
The universal content entity. Owner-first.

```sql
CREATE TABLE materials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type     material_type NOT NULL,

  -- Content fields (by type)
  title            TEXT,
  body             TEXT,                    -- text/note type
  url              TEXT,                    -- link/youtube type

  -- OpenGraph metadata (auto-fetched for link/youtube at capture time)
  og_title         TEXT,
  og_description   TEXT,
  og_image         TEXT,
  og_domain        TEXT,

  -- File metadata (file/image type only)
  storage_path     TEXT,
  storage_ref_id   TEXT REFERENCES storage_objects(ref_id),
  file_name        TEXT,
  file_size        BIGINT,
  mime_type        TEXT,

  -- Organisation
  tags             TEXT[] NOT NULL DEFAULT '{}',
  search_vec       TSVECTOR,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN index for full-text search
CREATE INDEX idx_materials_search ON materials USING GIN(search_vec);
CREATE INDEX idx_materials_owner ON materials(owner_id);
CREATE INDEX idx_materials_storage_ref ON materials(storage_ref_id);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
-- SELECT: owner_id = auth.uid()
--         OR material_id in user's library_materials
--         OR material_id in hive_material_shares for hives user belongs to
-- INSERT: owner_id = auth.uid()
-- UPDATE: owner_id = auth.uid()
-- DELETE: owner_id = auth.uid()
```

**tsvector trigger:**
```sql
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER materials_search_vec_update
  BEFORE INSERT OR UPDATE OF title, body, og_title, og_description, tags
  ON materials FOR EACH ROW
  EXECUTE FUNCTION update_materials_search_vec();
```

---

### storage_objects
Content-addressable file deduplication. Keyed by SHA-256 hash.

```sql
CREATE TABLE storage_objects (
  ref_id       TEXT PRIMARY KEY,              -- SHA-256 hex hash of file bytes
  storage_path TEXT NOT NULL UNIQUE,          -- bucket path: materials/{hash}/{filename}
  file_size    BIGINT NOT NULL,
  mime_type    TEXT NOT NULL,
  ref_count    INT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE storage_objects ENABLE ROW LEVEL SECURITY;
-- NO client access. service_role only.
```

**ref_count decrement trigger:**
```sql
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER materials_storage_ref_cleanup
  AFTER DELETE ON materials FOR EACH ROW
  EXECUTE FUNCTION decrement_storage_ref_count();
```

---

### shelf_items
Represents the user's desk. Temporary captures pending action.

```sql
CREATE TABLE shelf_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shelf_items_user ON shelf_items(user_id);

ALTER TABLE shelf_items ENABLE ROW LEVEL SECURITY;
-- All operations: user_id = auth.uid()
```

---

### library_materials
Permanent personal material archive.

```sql
CREATE TABLE library_materials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starred     BOOLEAN NOT NULL DEFAULT false,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_materials_user ON library_materials(user_id);
CREATE INDEX idx_library_materials_starred ON library_materials(user_id)
  WHERE starred = true;

ALTER TABLE library_materials ENABLE ROW LEVEL SECURITY;
-- All operations: user_id = auth.uid()
```

---

### hive_material_shares
Materials published into a hive. Independent from the origin material — NO CASCADE from materials.

```sql
CREATE TABLE hive_material_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id),   -- NO ON DELETE CASCADE
  hive_id     UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  shared_by   UUID NOT NULL REFERENCES users(id),
  folder_id   UUID REFERENCES folders(id),
  shared_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hive_material_shares_hive ON hive_material_shares(hive_id);
CREATE INDEX idx_hive_material_shares_material ON hive_material_shares(material_id);

ALTER TABLE hive_material_shares ENABLE ROW LEVEL SECURITY;
-- SELECT: hive members
-- INSERT: hive member (member role minimum)
-- DELETE: shared_by = auth.uid() OR user is admin+ in the hive
```

---

### folders
Folder structure within a hive. Supports nesting.

```sql
CREATE TABLE folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hive_id     UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
-- SELECT: hive members
-- INSERT/UPDATE: member+
-- DELETE: admin+
```

---

## Task & Calendar Tables

### tasks

```sql
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hive_id       UUID REFERENCES hives(id) ON DELETE CASCADE,  -- null = personal task
  creator_id    UUID NOT NULL REFERENCES users(id),
  assignee_id   UUID REFERENCES users(id),
  title         TEXT NOT NULL CHECK (char_length(title) <= 200),
  description   TEXT,
  status        task_status NOT NULL DEFAULT 'todo',
  priority      task_priority NOT NULL DEFAULT 'medium',
  due_at        TIMESTAMPTZ,
  search_vec    TSVECTOR,

  -- Calendar source tracking
  source        task_source NOT NULL DEFAULT 'personal',
  source_ref_id UUID,            -- if hive_deadline: original deadline task id

  -- Push reminder tracking
  last_reminded_at TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_due_at ON tasks(due_at);
CREATE INDEX idx_tasks_source_ref ON tasks(source_ref_id);
CREATE INDEX idx_tasks_search ON tasks USING GIN(search_vec);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
-- SELECT: hive members OR (hive_id IS NULL AND creator_id = auth.uid())
-- INSERT: hive member OR personal (hive_id IS NULL)
-- UPDATE/DELETE: creator_id = auth.uid() OR admin+ in hive
```

**tsvector trigger:**
```sql
CREATE FUNCTION update_tasks_search_vec() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vec := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_search_vec_update
  BEFORE INSERT OR UPDATE OF title, description
  ON tasks FOR EACH ROW
  EXECUTE FUNCTION update_tasks_search_vec();
```

---

### task_material_refs
Many-to-many relationship between tasks and materials.

```sql
CREATE TABLE task_material_refs (
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, material_id)
);

ALTER TABLE task_material_refs ENABLE ROW LEVEL SECURITY;
-- Access mirrors tasks table access
```

---

## Syllabus Tables

### syllabus_units

```sql
CREATE TABLE syllabus_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hive_id     UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE syllabus_units ENABLE ROW LEVEL SECURITY;
-- SELECT: hive members
-- INSERT/UPDATE/DELETE: member+
```

---

### syllabus_topics

```sql
CREATE TABLE syllabus_topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     UUID NOT NULL REFERENCES syllabus_units(id) ON DELETE CASCADE,
  hive_id     UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  material_id UUID REFERENCES materials(id),
  position    INT NOT NULL DEFAULT 0,
  search_vec  TSVECTOR,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_syllabus_topics_search ON syllabus_topics USING GIN(search_vec);

ALTER TABLE syllabus_topics ENABLE ROW LEVEL SECURITY;
-- SELECT: hive members
-- INSERT/UPDATE/DELETE: member+
```

**tsvector trigger:**
```sql
CREATE FUNCTION update_syllabus_topics_search_vec() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vec := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER syllabus_topics_search_vec_update
  BEFORE INSERT OR UPDATE OF title, description
  ON syllabus_topics FOR EACH ROW
  EXECUTE FUNCTION update_syllabus_topics_search_vec();
```

---

### syllabus_progress
Per-user per-topic completion state. Composite primary key.

```sql
CREATE TABLE syllabus_progress (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id     UUID NOT NULL REFERENCES syllabus_topics(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

ALTER TABLE syllabus_progress ENABLE ROW LEVEL SECURITY;
-- All operations: user_id = auth.uid()
```

---

## PWA & Preference Tables

### push_subscriptions
Web Push subscription objects per device per user.

```sql
CREATE TABLE push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh_key   TEXT NOT NULL,
  auth_key     TEXT NOT NULL,
  device_label TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- SELECT/DELETE: user_id = auth.uid()
-- INSERT: via server-side route handler only
```

---

### user_hive_preferences
Per-hive feed weight and notification muting. Composite primary key.

```sql
CREATE TABLE user_hive_preferences (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hive_id      UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
  feed_weight  feed_weight NOT NULL DEFAULT 'normal',
  last_visited_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, hive_id)
);

CREATE INDEX idx_user_hive_preferences_user ON user_hive_preferences(user_id);

ALTER TABLE user_hive_preferences ENABLE ROW LEVEL SECURITY;
-- All operations: user_id = auth.uid()
```

---

## Complete Table Inventory

| # | Table | Purpose |
|---|---|---|
| 1 | users | Core user entity, extends auth.users |
| 2 | user_preferences | Theme, calendar view preference |
| 3 | hives | Hive workspace |
| 4 | hive_members | Role per user per hive |
| 5 | hive_invites | Invite token system |
| 6 | announcements | Hive announcements |
| 7 | activity_log | Event log powering feeds |
| 8 | notifications | In-app + push notification records |
| 9 | materials | Universal content entity — owner-first |
| 10 | storage_objects | SHA-256 dedup + ref counting for files |
| 11 | shelf_items | Desk / quick-capture location |
| 12 | library_materials | Permanent personal material archive |
| 13 | hive_material_shares | Materials published into hives (independent) |
| 14 | folders | Folder structure within hives |
| 15 | tasks | Tasks with deadline and source tracking |
| 16 | task_material_refs | Task ↔ material many-to-many |
| 17 | syllabus_units | Syllabus top-level units |
| 18 | syllabus_topics | Syllabus leaf nodes |
| 19 | syllabus_progress | Per-user topic completion |
| 20 | push_subscriptions | PWA push notification device tokens |
| 21 | user_hive_preferences | Feed weight and notification muting per hive |

---

## Critical Rules (Repeat for Emphasis)

```
materials.owner_id          → set at creation, NEVER changes
materials DELETE            → cascades to shelf_items + library_materials (same owner only)
                               does NOT cascade to hive_material_shares
                               does NOT cascade to other users' copies
hive_material_shares        → independent lifecycle
storage_objects.ref_count   → decremented by trigger, file deleted when reaches 0
Every table                 → RLS enabled before migration committed
Raw SQL                     → only in migration files (triggers/functions)
Application queries         → Drizzle ORM only
```