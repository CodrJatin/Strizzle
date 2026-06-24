import {
  pgTable,
  pgSchema,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  bigint,
  timestamp,
  jsonb,
  check,
  index,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom type for PostgreSQL tsvector columns to support full-text search
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ---------------------------------------------------------
// Enums
// ---------------------------------------------------------

export const hiveRoleEnum = pgEnum('hive_role', ['owner', 'admin', 'member', 'viewer']);

export const materialTypeEnum = pgEnum('material_type', ['text', 'link', 'youtube', 'file', 'image']);

export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done', 'blocked']);

export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);

export const taskSourceEnum = pgEnum('task_source', ['personal', 'hive_deadline', 'shelf_converted']);

export const feedWeightEnum = pgEnum('feed_weight', ['priority', 'normal', 'muted']);

export const notificationTypeEnum = pgEnum('notification_type', [
  'hive_joined',
  'announcement_posted',
  'task_assigned',
  'mentioned',
  'material_shared',
  'deadline_added',
]);

// ---------------------------------------------------------
// Auth schema reference
// ---------------------------------------------------------

export const authSchema = pgSchema('auth');

export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
});

// ---------------------------------------------------------
// Core Tables
// ---------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme').notNull().default('default'),
  defaultCalView: text('default_cal_view').notNull().default('week'), // week | day | month
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hives = pgTable(
  'hives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    description: text('description'),
    courseCode: text('course_code'),
    colorTheme: text('color_theme').notNull().default('blue'),
    feedSettings: jsonb('feed_settings')
      .notNull()
      .default({
        show_member_joins: true,
        show_material_uploads: true,
        show_task_completions: false,
        show_syllabus_updates: true,
      }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('hives_name_check', sql`char_length(${table.name}) <= 100`),
  ]
);

export const hiveMembers = pgTable(
  'hive_members',
  {
    hiveId: uuid('hive_id')
      .notNull()
      .references(() => hives.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: hiveRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.hiveId, table.userId] }),
  ]
);

export const hiveInvites = pgTable('hive_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  hiveId: uuid('hive_id')
    .notNull()
    .references(() => hives.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  token: text('token')
    .notNull()
    .unique()
    .default(sql`gen_random_uuid()::text`),
  role: hiveRoleEnum('role').notNull().default('member'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').notNull().default(0),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  hiveId: uuid('hive_id')
    .notNull()
    .references(() => hives.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hiveId: uuid('hive_id')
      .notNull()
      .references(() => hives.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    actionType: text('action_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_activity_log_hive_created').on(table.hiveId, table.createdAt.desc()),
  ]
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    hiveId: uuid('hive_id')
      .references(() => hives.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    entityId: uuid('entity_id'),
    readAt: timestamp('read_at', { withTimezone: true }),
    pushSent: boolean('push_sent').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_notifications_user_read').on(table.userId, table.readAt),
  ]
);

// ---------------------------------------------------------
// Material System Tables
// ---------------------------------------------------------

export const storageObjects = pgTable('storage_objects', {
  refId: text('ref_id').primaryKey(),
  storagePath: text('storage_path').notNull().unique(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: text('mime_type').notNull(),
  refCount: integer('ref_count').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const materials = pgTable(
  'materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentType: materialTypeEnum('content_type').notNull(),

    // Content fields
    title: text('title'),
    body: text('body'),
    url: text('url'),

    // OpenGraph metadata
    ogTitle: text('og_title'),
    ogDescription: text('og_description'),
    ogImage: text('og_image'),
    ogDomain: text('og_domain'),

    // File metadata
    storagePath: text('storage_path'),
    storageRefId: text('storage_ref_id')
      .references(() => storageObjects.refId),
    fileName: text('file_name'),
    fileSize: bigint('file_size', { mode: 'number' }),
    mimeType: text('mime_type'),

    // Organisation
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    searchVec: tsvector('search_vec'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_materials_search').using('gin', table.searchVec),
    index('idx_materials_owner').on(table.ownerId),
    index('idx_materials_storage_ref').on(table.storageRefId),
  ]
);

export const shelfItems = pgTable(
  'shelf_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_shelf_items_user').on(table.userId),
  ]
);

export const libraryMaterials = pgTable(
  'library_materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    starred: boolean('starred').notNull().default(false),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_library_materials_user').on(table.userId),
    index('idx_library_materials_starred')
      .on(table.userId)
      .where(sql`starred = true`),
  ]
);

export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hiveId: uuid('hive_id')
      .notNull()
      .references(() => hives.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    parentId: uuid('parent_id')
      .references((): any => folders.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  }
);

export const hiveMaterialShares = pgTable(
  'hive_material_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id), // NO ON DELETE CASCADE
    hiveId: uuid('hive_id')
      .notNull()
      .references(() => hives.id, { onDelete: 'cascade' }),
    sharedBy: uuid('shared_by')
      .notNull()
      .references(() => users.id),
    folderId: uuid('folder_id')
      .references(() => folders.id),
    sharedAt: timestamp('shared_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_hive_material_shares_hive').on(table.hiveId),
    index('idx_hive_material_shares_material').on(table.materialId),
  ]
);

// ---------------------------------------------------------
// Task & Calendar Tables
// ---------------------------------------------------------

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hiveId: uuid('hive_id')
      .references(() => hives.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    assigneeId: uuid('assignee_id')
      .references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    status: taskStatusEnum('status').notNull().default('todo'),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    searchVec: tsvector('search_vec'),
    source: taskSourceEnum('source').notNull().default('personal'),
    sourceRefId: uuid('source_ref_id'),
    lastRemindedAt: timestamp('last_reminded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_tasks_assignee').on(table.assigneeId),
    index('idx_tasks_due_at').on(table.dueAt),
    index('idx_tasks_source_ref').on(table.sourceRefId),
    index('idx_tasks_search').using('gin', table.searchVec),
    check('tasks_title_check', sql`char_length(${table.title}) <= 200`),
  ]
);

export const taskMaterialRefs = pgTable(
  'task_material_refs',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.materialId] }),
  ]
);

// ---------------------------------------------------------
// Syllabus Tables
// ---------------------------------------------------------

export const syllabusUnits = pgTable('syllabus_units', {
  id: uuid('id').primaryKey().defaultRandom(),
  hiveId: uuid('hive_id')
    .notNull()
    .references(() => hives.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  position: integer('position').notNull().default(0),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const syllabusTopics = pgTable(
  'syllabus_topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => syllabusUnits.id, { onDelete: 'cascade' }),
    hiveId: uuid('hive_id')
      .notNull()
      .references(() => hives.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    materialId: uuid('material_id')
      .references(() => materials.id),
    position: integer('position').notNull().default(0),
    searchVec: tsvector('search_vec'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_syllabus_topics_search').using('gin', table.searchVec),
  ]
);

export const syllabusProgress = pgTable(
  'syllabus_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => syllabusTopics.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.topicId] }),
  ]
);

// ---------------------------------------------------------
// PWA & Preference Tables
// ---------------------------------------------------------

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dhKey: text('p256dh_key').notNull(),
    authKey: text('auth_key').notNull(),
    deviceLabel: text('device_label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_push_subscriptions_user').on(table.userId),
  ]
);

export const userHivePreferences = pgTable(
  'user_hive_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    hiveId: uuid('hive_id')
      .notNull()
      .references(() => hives.id, { onDelete: 'cascade' }),
    feedWeight: feedWeightEnum('feed_weight').notNull().default('normal'),
    lastVisitedAt: timestamp('last_visited_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.hiveId] }),
    index('idx_user_hive_preferences_user').on(table.userId),
  ]
);
