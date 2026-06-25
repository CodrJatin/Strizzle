# Strizzle — Product Requirements Document

> Version 2.0 — Greenfield Build  
> Status: Final Draft  
> Date: June 2026  
> Build Type: From scratch — no V1 dependency  
> Core Philosophy: Individual-first, hive-enhanced

---

## 1. Product Vision

Strizzle is a personal study platform that helps students capture, organise, and act on their study material — alone or with others. Unlike tools that require a group to deliver value, Strizzle is immediately useful to a single student from the moment they sign up. Collaborative features (hives) are a powerful enhancement, not a prerequisite.

### 1.1 Problem Statement

Students manage their academic lives across five to eight disconnected tools: a university LMS for assignments, WhatsApp for group coordination, Google Drive for files, Notion for notes, a calendar app for deadlines, and a browser for research. The result is fragmented attention, lost materials, missed deadlines, and no single view of their academic world.

### 1.2 The Individual-First Principle

> Every feature must be useful to a solo student who has never joined a hive.  
> Hives are an upgrade — they add collaborative value on top of a personal foundation.  
> A student with zero hive memberships should find the app indispensable.

### 1.3 Target Users

| Persona | Description | Primary Jobs-to-be-Done |
|---|---|---|
| Solo Studier | Individual student managing their own coursework | Capture notes on the go, organise study materials, track deadlines, review starred content offline |
| Study Group Leader | Organises peers around a course | Post announcements, share materials, track group syllabus progress, manage hive members |
| Passive Group Member | Joins hives for shared resources | Browse hive materials, add deadlines to personal calendar, star useful materials |
| Heavy Multitasker | Enrolled in 4+ courses simultaneously | Unified feed across all hives, global search across all materials, cross-hive task view |

### 1.4 Success Metrics

| Metric | Target | Measured By |
|---|---|---|
| Day-7 retention | ≥ 40% | Users who return within 7 days of registration |
| Solo engagement | ≥ 60% of active users use desk or library weekly | Event: desk_item_created, library_material_saved |
| Hive creation | ≥ 2 hives per active user per semester | hives table row count per user |
| Material capture rate | ≥ 5 items captured per user per week | materials rows created |
| Search adoption | ≥ 70% of active users use global search | Event: global_search_performed |
| PWA install rate | ≥ 25% of mobile users install to home screen | beforeinstallprompt + appinstalled events |
| Task completion rate | ≥ 60% of tasks with due_at reach status=done | tasks table query |

---

## 2. Information Architecture

### 2.1 Global Navigation

| Route | Page | Purpose |
|---|---|---|
| /dashboard | Dashboard | Hive cards, starred materials panel, My Tasks panel, quick-create |
| /desk | Desk | Quick-capture inbox — temporary shelf items pending action |
| /library | Library | Personal material archive + all hive materials grouped by hive |
| /calendar | Calendar | Week/day/month view over all tasks and deadlines |
| /feed | Shared Feed | Unified cross-hive activity stream |
| /settings | Settings | Profile, theme, notifications, hive preferences, offline cache |
| /login /register /onboarding | Auth & Onboarding | Authentication and first-run setup |

### 2.2 Hive Navigation

| Route | Section | Purpose |
|---|---|---|
| /hive/[id]/overview | Overview | Hive description, live feed, announcements, deadlines |
| /hive/[id]/materials | Materials | Shared material library with folder structure |
| /hive/[id]/tasks | Tasks | Hive kanban board |
| /hive/[id]/syllabus | Syllabus | Unit > Topic tree with per-member progress |
| /hive/[id]/settings | Settings | Members, roles, invite links, feed config, danger zone |

---

## 3. Feature Specifications

### 3.1 Authentication & Onboarding

Handled entirely by Supabase Auth. Three sign-in methods supported. On first login, users complete a two-step onboarding before reaching the dashboard.

**Sign-in Methods**
- Email + password with client-side and server-side Zod validation
- Google OAuth — one-tap sign-in, redirects through /auth/callback
- Magic link — email input, Supabase sendMagicLink, confirmation screen

**Onboarding Flow (first login only)**
- Step 1: Full name input (pre-filled from OAuth display name if available)
- Step 2: Avatar upload — file picker + drag-drop, stored in Supabase Storage avatars bucket, max 2MB
- Step 3: Theme selection — preview cards for available themes, stored in user_preferences
- On completion: INSERT user_preferences row, redirect to /dashboard

**Acceptance Criteria**
- All /app/* routes redirect to /login if session absent (proxy.ts middleware)
- JWT session persists across browser refresh and tab close
- Google OAuth and magic link both complete within 30 seconds
- Onboarding completable in under 90 seconds

---

### 3.2 Desk (Quick Capture)

The Desk is the student's capture inbox — a frictionless way to save anything during a lecture, a break, or while browsing, without deciding where it goes yet. Every capture creates a `materials` row and a `shelf_items` row immediately.

**Floating Action Button (FAB)**
- Visible on every page of the app (bottom-right, fixed position)
- Keyboard shortcut: Cmd/Ctrl + Shift + A
- Opens the Quick-Add modal

**Quick-Add Modal — Input Modes**
- Text / Note: multiline textarea, no formatting, plain capture
- URL / Link: input field with real-time type detection (YouTube vs generic link). OpenGraph metadata fetched automatically 400ms after user stops typing — title and thumbnail preview shown inside the modal before submit
- File: file picker + drag-drop zone. Accepts: PDF, DOCX, PPTX, images. Max 50MB. SHA-256 hash computed client-side before upload for deduplication

**Content Type Auto-Detection**

| Input | Detected Type | Metadata Fetched |
|---|---|---|
| Plain text | text | None |
| youtube.com or youtu.be URL | youtube | oEmbed: title + thumbnail |
| Any other URL | link | OpenGraph: og:title, og:image, og:description, domain |
| File upload (.pdf .docx .pptx) | file | filename, size, mime_type |
| Image upload (.jpg .png .webp .gif) | image | filename, size, dimensions |

**Desk Item Action Modal**

| Action | Available For | Result |
|---|---|---|
| Share to hive as material | All types | shareMaterialToHive — hive + folder selector |
| Save to library | All types | Creates library_materials row |
| Convert to task / deadline | All types | Pre-fills task modal with content as title/description |
| Post as hive announcement | text, link, youtube | Pre-fills announcement with content as body |
| Save as personal note | text | Saves to library as text material |

Every action modal has a bottom section: "After this action" — Keep on Desk / Move to Library / Remove from Desk. Part of the same form submit, not a follow-up step.

**Web Share Target (PWA)**
- Strizzle appears in the OS share sheet on Android and iOS Safari 16.4+
- Shared URL, text, or file arrives at /api/share-target route handler
- Route handler: detect content type → fetch OG metadata → create materials row → create shelf_items row → redirect to /desk
- Unauthenticated share: payload stored in session cookie → redirect to login → consumed after /auth/callback

---

### 3.3 Library

The Library is the student's permanent personal material archive. It contains materials they have explicitly saved, alongside a view of all materials from every hive they belong to.

**Two Content Sources**
- My Materials — `library_materials` rows where user_id = current user
- From My Hives — `hive_material_shares` rows joined to hives the user is a member of, grouped by hive with a hive name header

**Controls**
- Search bar — full-text search across all content in both sections
- Filter: All Types / Files / Links / YouTube / Text
- Sort: Recent / Name / Size / Type
- Starred toggle — shows only starred materials
- View: Grid (default) / List

**Material Card Actions**
- Open (all types)
- Star / Unstar — sets `library_materials.starred`. Starring a hive material first copies it to the user's personal library
- Share to hive — opens hive + folder selector
- Copy to my library — for hive materials not yet saved personally. Creates new `materials` row with owner_id = current user. File: increments `storage_objects.ref_count`, reuses `storage_path`
- Download for offline — file/image only. Sends message to service worker to cache the storage URL
- Delete — personal materials only. If material has active hive shares: warning shown. Checkbox (unchecked): "Also remove from hives you shared it to"

---

### 3.4 Dashboard

The first page after login. Gives the student an at-a-glance view of their hive world, starred materials, and upcoming tasks.

**Sections**
- Hive Cards — grid of hives the user belongs to. Card: color theme bar, hive name, course code, member count, unread activity badge
- Starred Materials — horizontal scroll row of `library_materials WHERE starred = true`, max 6 cards
- My Tasks — tasks where `assignee_id` or `creator_id` = current user, sorted by `due_at` ASC
- Quick Create buttons — New Hive, New Task, New Desk Capture

---

### 3.5 Calendar

A personal view of all tasks and deadlines across every context the student is in. Pure view layer over the tasks table.

**View Modes**
- Week view (default) — 7-column grid with hourly time slots
- Day view — single column, full 24 hours
- Month view — standard grid, max 3 task chips per day, overflow shows "+ N more"

**Task Blocks**
- Colored by priority: Low = muted gray, Medium = blue, High = amber, Urgent = red
- Hive badge shown on tasks originating from a hive
- Click: opens task detail modal
- Drag to reschedule (week and day views): optimistic update on due_at

**"Add to Calendar" from Hive Deadlines**
- Available on deadline cards in hive overview and shared hive feed
- Creates a personal task with `source = hive_deadline` and `source_ref_id` = original deadline id
- Dedup check: if task already exists with same `source_ref_id` + `creator_id`, button shows "Added ✓"

---

### 3.6 Hive System

A Hive is a collaborative workspace organised around a course or subject.

**Roles**

| Role | Who | Permissions |
|---|---|---|
| Owner | Hive creator | Full control including hive deletion, all settings, all content operations |
| Admin | Appointed by Owner | Manage members and roles below Admin, post announcements, edit/delete any content, configure feed settings |
| Member | Default on invite acceptance | Upload materials, create and edit own tasks, update syllabus, post comments |
| Viewer | Lower-privilege invite | Read-only: view materials, syllabus, announcements. Cannot upload or create tasks |

**Invite System**
- Owner/Admin generates a shareable invite link from Settings > Sharing
- Options: role assignment (default: Member), expiry (24h / 7d / no expiry), max uses
- Tokens stored in `hive_invites` table
- Resend sends invite email if email address provided alongside the link
- Active links listable and revokable from Settings

---

### 3.7 Hive Overview

The landing page of a hive. Four sections:

- **Hive Header** — name, description, course code, member count, color bar. Edit button for Admin+
- **Announcements** — card-based, newest first. Author avatar, relative timestamp, markdown body. Post button for Admin+
- **Deadlines** — upcoming tasks with due_at, sorted ascending. Each deadline has an inline "Add to Calendar" button. Overdue items in red
- **Hive Feed** — scoped `activity_log` for this hive. Real-time via Supabase Realtime. Admin can configure which event types appear in hive Settings

---

### 3.8 Hive Materials

The shared material library within a hive. Materials are user-owned and published into hives.

- Folder tree sidebar — root folders and nested subfolders
- "Share to Hive" button (Member+) — opens a modal: choose material from library or desk, or add new URL/file
- Material cards — OG preview card for links/youtube, file type icon + filename + size for files. Shows sharer name, shared date, type badge
- Remove from hive — sharer or Admin+. Removes `hive_material_shares` row only. Owner's library copy unaffected

---

### 3.9 Hive Tasks (Task Studio)

A kanban board scoped to a hive.

**Kanban Columns:** Todo / In Progress / Done / Blocked

**Task Fields**

| Field | Type | Notes |
|---|---|---|
| Title | Text (max 200) | Required |
| Description | Markdown textarea | Optional |
| Status | Enum: todo / in_progress / done / blocked | Default: todo |
| Priority | Enum: low / medium / high / urgent | Default: medium |
| Due date + time | Datetime picker | Optional. Appears in hive deadlines panel and calendar |
| Assignee | Hive member dropdown | Optional. Triggers push notification on assignment |
| Material references | Array of material IDs | Attached via global search in attach mode |

---

### 3.10 Hive Syllabus

A hierarchical checklist. Two levels: Unit → Topic. Each student tracks their own progress independently.

- Collapsible unit accordion with drag-and-drop reordering
- Topic row: checkbox (per-user, optimistic toggle), title, optional description, optional linked material chip
- Completed topics: strikethrough title, muted color
- Per-unit progress bar showing fraction and percentage
- Overall circular progress indicator at top of page
- Admin+ view: badge on each topic showing "X / total members completed"

---

### 3.11 Global Search

**Trigger:** Cmd/Ctrl + K or search icon tap on mobile

**Searchable Entities & Scope**

| Entity | Indexed Fields | Scope |
|---|---|---|
| Materials (personal) | title, body, og_title, og_description, tags | owner_id = current user OR in library_materials |
| Materials (hive) | title, og_title, og_description, tags | hive_id in user's hives via hive_material_shares |
| Hives | name, description, course_code | hive_id in user's hive memberships |
| Tasks | title, description | hive_id in user's hives OR personal tasks |
| Syllabus topics | unit name, topic title, description | hive_id in user's hives |

**Behaviour**
- Input debounced at 200ms. Results appear within 300ms target
- Results grouped by entity type with section headers
- Click: navigates directly to the entity in context
- Attach mode: triggered from task detail modal. Results are checkbox-selectable, returns selected materialIds via onSelect callback

---

### 3.12 Shared Hive Feed

A unified, cross-hive activity stream.

**Feed Items & Direct Actions**

| Item Type | Content | Direct Actions |
|---|---|---|
| Announcement | Title, body preview, author, hive badge, time | Open in hive (read-only) |
| New material | OG preview card, sharer, hive badge, type badge | Star (copies to library), Share to another hive |
| Deadline | Title, due date, hive badge | Add to Calendar (with dedup), Open in hive |
| Activity | Icon, text description, hive badge, time | Open in hive |

**Feed Filtering**
- Hive filter — multiselect dropdown of user's hives
- Type filter — Announcements / Materials / Deadlines / Activity
- Time filter — Today / This Week / This Month / All Time. Default: This Week

**Smart Grouping (Frontend)**
- Consecutive activity_log rows with same hive_id + same action_type within a 1-hour window are grouped into one card
- Expand chevron to see individual items. No backend change — pure frontend rendering logic

**Muting**
- Hives set to "muted" in Settings > Notifications are excluded from the shared feed
- Muted hives also suppress push notifications

---

### 3.13 Notifications

**In-App Notifications**
- Bell icon in topnav with unread count badge
- Dropdown: max 8 items, scrollable. Each: type icon, text, hive badge, relative time, unread dot
- Click: mark as read + navigate to entity
- Unread badge updates in real-time via Supabase Realtime

**Push Notifications (PWA)**
- Triggered by: task assigned, hive announcement posted, task deadline within 24 hours (hourly pg_cron check)
- Muted hives: push suppressed even if subscribed
- iOS: requires PWA added to home screen first. Onboarding banner shown on iOS Safari
- Multiple devices: each device registers its own `push_subscriptions` row
- Expired endpoints (HTTP 410): subscription row automatically deleted

---

### 3.14 Theming

Users choose their app color theme during onboarding and can change it any time in Settings > Appearance. Theme switches instantly without a page reload.

**Technical Implementation**
- shadcn/ui initialised with --css-vars flag — all components reference CSS variables
- ThemeProvider sets `data-theme` attribute on `<html>` element
- `globals.css` defines one block per theme: `[data-theme="x"] { --color-primary: ...; ... }`
- SSR: initial theme read from a cookie set on preference save — no flash of wrong theme on load
- "Match system" option: switches between light and dark base theme using `prefers-color-scheme`

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target | Strategy |
|---|---|---|
| LCP | < 2.5s on 4G | Server-side prefetch in layouts, next/image, CDN-served assets |
| CLS | < 0.1 | Skeleton screens sized to match real content, explicit image dimensions |
| FID / INP | < 100ms | Optimistic updates, no blocking mutations, React Server Components |
| Global search response | < 300ms | GIN index, plainto_tsquery, result limit 20, query debounce 200ms |
| Page navigation (returning) | Instant (< 50ms) | Stale-while-revalidate: cached data renders before network |
| File upload (10MB) | Progress visible within 1s | Presigned URL, direct browser-to-storage upload |

### 4.2 Caching Strategy

> Rule: if the user has seen this data before, they never see a spinner when returning to it.

| Query | staleTime | Rationale |
|---|---|---|
| Hive overview, calendar, shared feed | 30s | Changes frequently |
| Materials list, task list | 2min | Moderate change rate |
| Syllabus tree | 5min | Rarely changes mid-session |
| User profile, user preferences | 15min | Almost never changes |
| Global search | 0 (always fresh) | Must reflect latest content |

### 4.3 Security

- All /app/* routes protected by proxy.ts middleware
- RBAC enforced at two layers: tRPC procedure (enforceRole helper) AND Supabase Row Level Security
- Every table has RLS enabled before the migration is committed
- `storage_objects` table: service_role only — no client access
- Invite tokens: signed, stored with expiry and use count, revocable at any time
- File upload: MIME type validated client-side and server-side. Max 50MB
- VAPID private key: stored as Supabase Edge Function secret, never in codebase or client bundle
- CSP headers configured in next.config.ts
- All secrets in environment variables

### 4.4 Accessibility

- WCAG 2.1 Level AA compliance for all interactive components
- All icon-only buttons have aria-label
- Focus management: modal open → focus first interactive element; modal close → focus returns to trigger
- Keyboard navigation: global search Cmd+K, quick-add Cmd+Shift+A, all dropdowns arrow-navigable
- Drag-and-drop has keyboard alternative (Enter → Move to column select)
- Color is never the sole indicator — priority badges use color + icon
- Minimum touch target size: 44 × 44px

### 4.5 Free Tier Budget

| Service | Free Allowance | Projected Usage | Risk |
|---|---|---|---|
| Vercel | 100GB bandwidth/mo | ~5–10GB for early users | Low |
| Supabase Postgres | 500MB storage | ~150MB for 500 active users | Low |
| Supabase Storage | 1GB file storage | Depends on file upload volume | Medium |
| Supabase Realtime | 200 concurrent connections | 1 per open hive tab | Low |
| Supabase Edge Functions | 500K invocations/mo | ~10K for push + storage cleanup | Low |
| Resend | 3,000 emails/mo | ~1 per invite | Low |
| Upstash Redis | 10,000 commands/day | ~5 per rate-limited action | Low |

---

## 5. Out of Scope — V2 Launch

| Feature | Reason Deferred | Target |
|---|---|---|
| Google Calendar sync (two-way) | OAuth scope complexity, refresh token management | V3 |
| In-app messaging / DMs | Moderation, high complexity | V3 |
| AI study summaries from materials | LLM cost and integration scope | V3 |
| Quiz / flashcard generator | Feature scope expansion | V3 |
| Public hive discovery | Moderation and privacy implications | V3 |
| Stripe payments / premium tier | Business model decision pending | V3 |
| Native iOS / Android app | PWA covers mobile for V2 | V4 |
| Collaborative real-time editing | Y.js or similar needed | V4 |