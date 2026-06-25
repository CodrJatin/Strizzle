# StudyHive V2 — Development Plan

> Greenfield Build · Individual-First · 6 Phases · ~14–18 Weeks  
> Version 2.0 · June 2026  
> Stack: Next.js 16 · Supabase · Drizzle · tRPC · Serwist · Vercel

---

## Engineering Overview

StudyHive V2 is a greenfield build. There is no V1 to maintain, migrate from, or be backward-compatible with. Phase 1 establishes the complete V2 schema in one shot, and every subsequent phase builds forward on a clean foundation. The application must be deployable at the end of every phase.

### Phase Summary

| Phase | Name | Duration | End State |
|---|---|---|---|
| 1 | Foundation — Repo, Auth, Schema, Shell | 2 weeks | Authenticated app shell deployed. Full schema live on Supabase staging. Every table has RLS. |
| 2 | Individual Core — Desk, Library, Dashboard, Global Search | 3 weeks | A solo student can capture material, organise their library, and search everything. No hive needed. |
| 3 | Hive System — Creation, Members, Overview, Materials, Invites | 3 weeks | Full collaborative hive workflow. Users can create hives, invite members, share materials. |
| 4 | Tasks, Syllabus & Calendar | 2 weeks | Full task studio with kanban. Syllabus tracking. In-app calendar with Add to Calendar. |
| 5 | PWA, Theming, Push Notifications & Performance | 3 weeks | Multi-theme system. Web Share Target. Push notifications. Offline starred materials. Full SWR + optimistic updates. |
| 6 | Shared Feed, Hive Redesign, Polish & Launch | 2–4 weeks | Shared hive feed. Hive overview redesign. Full E2E suite. Core Web Vitals passing. Production launch. |

### Non-Negotiable Engineering Rules

- Every new table gets RLS policies before the migration file is committed — no exceptions
- Every mutation has an optimistic update — the UI never waits for the server
- Every query uses stale-while-revalidate — cached data renders before the network
- No TypeScript `any` — use `unknown` and narrow, or define the type
- No raw SQL in application code — Drizzle ORM for all queries. Raw SQL only in migration files
- No spinner for returning users — skeleton screens only on first-ever page load
- Run `npx tsc --noEmit` before every commit — zero type errors at all times
- Run the Playwright suite against staging before every production deploy

---

## Phase 1 — Foundation: Repo, Auth, Schema & Shell
**Weeks 1–2**  
*A fully configured monorepo, working authentication, the complete V2 database schema with RLS, and an authenticated layout shell deployed to Vercel.*

### Objectives
- Initialize Next.js 16 monorepo with all tooling configured
- Create fresh Supabase project (staging). Configure Auth, Storage, Realtime, pg_cron
- Write and apply the complete V2 schema — all 22 tables — in migration 001
- Enable RLS on every table with policies before the migration is committed
- Implement all auth flows: email/password, Google OAuth, magic link, onboarding
- Build the authenticated layout shell: topnav, sidebar, FAB placeholder
- Deploy to Vercel with staging and preview deploy environments

### Tasks

| # | Task | Implementation Notes | Est. |
|---|---|---|---|
| 1.1 | Initialize Next.js 16 project | npx create-next-app@latest --typescript --tailwind --app --src-dir. tsconfig strict:true, path aliases @/*. Install: Prettier, ESLint (next/core-web-vitals), knip, @total-typescript/ts-reset | 0.5d |
| 1.2 | Install and configure shadcn/ui | npx shadcn@latest init — CSS variables mode. Add components: Button, Input, Card, Dialog, DropdownMenu, Avatar, Badge, Separator, Form, Label, Popover, Command, Sheet, Collapsible, Sonner, Skeleton, Progress, Tabs, Accordion, Calendar, Select, Textarea, Checkbox, RadioGroup, ScrollArea | 0.5d |
| 1.3 | Install all project dependencies | tRPC, TanStack Query, Drizzle, Zod, Zustand, Framer Motion, @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities, react-hook-form @hookform/resolvers, sonner, @internationalized/date, @serwist/next serwist, web-push @types/web-push, Sentry, Resend | 0.5d |
| 1.4 | Create Supabase staging project | New Supabase project. Enable: Email auth, Google OAuth. Create buckets: avatars, materials. Enable pg_cron + pg_net extensions. Copy all keys to .env.local | 0.5d |
| 1.5 | Write complete V2 schema — db/schema.ts | Define all 22 tables as Drizzle schema. Define all 7 pgEnums. See SCHEMA.md for full definition | 2d |
| 1.6 | Set up Drizzle config and migration workflow | drizzle.config.ts pointing to Supabase connection string. npx drizzle-kit generate → review SQL → npx drizzle-kit push to staging. Verify all tables in Supabase table editor | 0.5d |
| 1.7 | Write RLS policies for all 22 tables | Enable RLS on every table. Write SELECT/INSERT/UPDATE/DELETE policies per table. Test each policy with a second Supabase user | 1.5d |
| 1.8 | Write Postgres triggers and functions | (1) tsvector trigger on materials. (2) tsvector trigger on tasks. (3) tsvector trigger on syllabus_topics. (4) storage_objects ref_count decrement trigger on materials DELETE. All as raw SQL in migration 001 | 1d |
| 1.9 | Create all indexes | GIN: materials.search_vec, tasks.search_vec, syllabus_topics.search_vec. BTREE: all critical lookup columns per SCHEMA.md | 0.5d |
| 1.10 | Set up tRPC | server/trpc.ts: createTRPCContext, createTRPC, publicProcedure, protectedProcedure. server/routers/root.ts: empty root router. app/api/trpc/[trpc]/route.ts. providers.tsx: TRPCProvider + QueryClient with global staleTime:120000, gcTime:600000 | 1d |
| 1.11 | Implement enforceRole helper | server/trpc.ts: async function enforceRole(ctx, minRole, hiveId). Queries hive_members. Throws TRPCError FORBIDDEN if insufficient. Used inside every hive-scoped procedure | 0.5d |
| 1.12 | Auth middleware — proxy.ts | Creates Supabase server client from cookies. Checks session. No session + /app/*: redirect to /login?returnUrl=. Session + /login: redirect to /dashboard | 0.5d |
| 1.13 | Build /login page | Email+password form (react-hook-form + Zod). Google OAuth button. Magic link link. Inline error display. Redirect to /dashboard or returnUrl | 0.5d |
| 1.14 | Build /register page | Name + email + password. Zod: min 8 chars. Supabase signUp. Redirect to /onboarding | 0.5d |
| 1.15 | Build /login/magic and /auth/callback | Email input → Supabase sendMagicLink → confirmation screen. /auth/callback: exchanges code for session, reads returnUrl cookie | 0.25d |
| 1.16 | Build /onboarding page (3 steps) | Step 1: full_name. Step 2: avatar upload (Supabase Storage avatars bucket). Step 3: theme selection (preview cards). On complete: INSERT user_preferences → /dashboard | 1d |
| 1.17 | Build authenticated layout shell | app/(app)/layout.tsx. Sidebar: logo, global nav, hive list, user avatar. Topnav: breadcrumb, search input (Cmd+K placeholder), notification bell, user avatar dropdown. FAB: fixed bottom-right. Mobile: Sheet sidebar | 1.5d |
| 1.18 | Deploy to Vercel | Connect GitHub. Configure env vars. Preview deployments on PRs. Branch protection: passing build + type check. Sentry source maps in next.config.ts | 0.5d |

### Deliverables
- [ ] Next.js 16 monorepo: TypeScript strict, Tailwind, shadcn (CSS vars mode), all dependencies
- [ ] Supabase staging project: Auth, Storage buckets, pg_cron + pg_net enabled
- [ ] Migration 001: all 22 tables, all enums, all tsvector triggers, all indexes applied
- [ ] RLS policies on all 22 tables — tested with two users
- [ ] tRPC with protectedProcedure, enforceRole helper, global SWR QueryClient config
- [ ] Auth flows: email/password, Google OAuth, magic link, 3-step onboarding
- [ ] Authenticated layout shell: sidebar, topnav, FAB placeholder, mobile responsive
- [ ] Vercel deployment: staging + preview deploys on PR, Sentry configured

---

## Phase 2 — Individual Core: Desk, Library, Dashboard & Search
**Weeks 3–5**  
*A solo student can capture anything to their desk, organise their personal library, search across all their content, and see their world on the dashboard. No hive required.*

### Objectives
- Material creation: all 5 content types with SHA-256 dedup for files
- Desk page with FAB quick-add modal, OG preview at capture time, action modal
- Library page: personal materials + placeholder for hive section
- Dashboard: hive cards (empty state), starred materials panel, My Tasks (empty state)
- Global search: Command Palette (Cmd+K) across all user-accessible content

### Tasks

| # | Task | Implementation Notes | Est. |
|---|---|---|---|
| 2.1 | lib/hashFile.ts | async function hashFile(file: File): Promise<{hash:string, size:number}>. Uses window.crypto.subtle.digest("SHA-256"). Returns hex string | 0.25d |
| 2.2 | lib/fetchLinkMeta.ts | Server-side utility. YouTube: oEmbed API → title + thumbnail. Generic URL: fetch HTML → parse og:title, og:image, og:description, domain. Timeout 5s, fail gracefully | 0.5d |
| 2.3 | tRPC: createTextMaterial + createLinkMaterial | createTextMaterial({body, tags}): INSERT materials (content_type=text). createLinkMaterial({url, tags}): detect youtube vs generic, call fetchLinkMeta(), INSERT materials with og_* fields | 0.5d |
| 2.4 | tRPC: file upload with dedup | checkStorageObject({hash}): SELECT storage_objects. getPresignedUploadUrl({hash, filename, mimeType}): if exists return existing path, if not return signed URL. confirmFileUpload({hash, filename, mimeType, fileSize}): UPSERT storage_objects (INSERT or increment ref_count), INSERT materials | 1.5d |
| 2.5 | tRPC: material CRUD | getMaterials, deleteMaterial (owner check, optional hive share cleanup), updateMaterial, getStarredMaterials | 1d |
| 2.6 | tRPC: shelf | createShelfItem, getShelfItems (JOIN materials), deleteShelfItem, moveToLibrary (DELETE shelf + INSERT library in transaction) | 0.5d |
| 2.7 | tRPC: library | getLibraryMaterials, starMaterial (copy flow for hive materials), unstarMaterial, addToLibrary (copy + INSERT library_materials) | 1d |
| 2.8 | Quick-Add modal component | Three tabs: Text (textarea + tags), Link (URL + live OG preview card with 400ms debounce), File (drag-drop zone + SHA-256 hash + dedup check). On submit: create material → create shelf item. Optimistic desk update | 2d |
| 2.9 | Desk page /desk | Grid of ShelfItemCard components. Newest first. Infinite scroll. Empty state: "Your desk is clear" | 1d |
| 2.10 | ShelfItemCard component | 5 variants: text (left border), link (OG thumbnail), youtube (thumbnail + play overlay), file (type icon), image (full bleed). Shimmer variant for optimistic insert | 0.5d |
| 2.11 | Desk item Action Modal | Actions by content_type per PRD matrix. "After this action" radio at bottom of each sub-modal (Keep / Move to Library / Remove). Lifecycle choice in same form submit | 1.5d |
| 2.12 | Library page /library | Two sections: My Materials (library_materials), From My Hives (placeholder). Search, filter, sort, starred toggle, grid/list toggle. Infinite scroll. Skeleton on first load | 1.5d |
| 2.13 | Library material card + actions | Hover overlay with action icons: Open, Star/Unstar, Share (placeholder), Download for offline (placeholder), Delete (with hive share warning modal) | 0.5d |
| 2.14 | Dashboard /dashboard | Four sections: Hive Cards grid (empty state), Starred Materials row (library WHERE starred), My Tasks list (placeholder), Quick Create buttons. Server-side prefetch in layout | 1d |
| 2.15 | Global Search Command Palette | tRPC globalSearch: plainto_tsquery on materials + tasks + syllabus, scoped to user. UI: shadcn CommandDialog, 200ms debounce, grouped results, entity icons, hive badges. Attach mode: checkbox selectable, onSelect callback | 1.5d |
| 2.16 | Optimistic updates — Phase 2 | Apply to: createShelfItem, deleteShelfItem, moveToLibrary, starMaterial, unstarMaterial, deleteMaterial. Each: cancel inflight → snapshot → setData → onError rollback → toast.error | 1d |

### Deliverables
- [ ] SHA-256 content-addressable file upload with dedup via storage_objects
- [ ] All 5 material types: text, link, youtube (oEmbed), file, image
- [ ] Desk page with FAB quick-add: text, URL (live OG preview), file upload
- [ ] Desk item action modal with all conversion flows and lifecycle choice
- [ ] Library page: personal materials with search, filter, sort, star
- [ ] Dashboard: starred panel, empty-state hive grid, My Tasks placeholder
- [ ] Global search Command Palette (Cmd+K) with attach mode
- [ ] Optimistic updates on all Phase 2 mutations

---

## Phase 3 — Hive System: Creation, Members, Overview, Materials & Invites
**Weeks 6–8**  
*Full collaborative hive workflow. Users can create hives, invite members, share materials, and use the hive overview page.*

### Objectives
- Hive CRUD with role enforcement at tRPC and RLS layers
- Invite system: generate, share, accept, revoke. Resend email delivery
- Hive overview: header, announcements, deadlines panel, live activity feed
- Hive materials: share materials into hives, folder structure, OG preview cards
- Library "From My Hives" section populated
- Activity logging on all hive events

### Tasks

| # | Task | Implementation Notes | Est. |
|---|---|---|---|
| 3.1 | tRPC router: hive CRUD | createHive + INSERT hive_members (owner) in transaction. getHive with user role. getUserHives with member count. updateHive enforceRole admin. deleteHive enforceRole owner | 1d |
| 3.2 | tRPC router: members | getHiveMembers with user info. changeRole (enforceRole admin). removeMember (enforceRole admin or self). leaveHive (owner must transfer first) | 0.5d |
| 3.3 | tRPC router: invites | generateInviteLink (enforceRole admin, crypto.randomUUID token). revokeInvite. acceptInvite (validate token, INSERT hive_members, INCREMENT use_count, logActivity). listInvites | 1d |
| 3.4 | Resend invite email | React Email template. sendInviteEmail({toEmail, hiveName, role, inviteUrl}). Called from generateInviteLink if email provided | 0.5d |
| 3.5 | /invite/[token] public route | Show hive name + role from token lookup. Unauthenticated: redirect to /login?returnUrl. Authenticated: confirm → acceptInvite → /hive/[id]/overview | 0.5d |
| 3.6 | Hive layout and context | app/(app)/hive/[hiveId]/layout.tsx. Sub-nav. HiveStore in Zustand (currentHiveId, userRole). Server-side prefetch getHive + getHiveOverview. HydrationBoundary | 1d |
| 3.7 | Activity logging helper | server/lib/logActivity.ts. Called in tRPC procedures on: hive join, material share, task create, announcement post, member role change | 0.25d |
| 3.8 | Supabase Realtime hook | hooks/useRealtimeHive.ts. Subscribes to activity_log INSERT (hive_id filter) → prepend to cached feed (setQueryData). Subscribes to notifications INSERT (user_id filter) → increment Zustand notificationCount. Mounted in hive layout | 1d |
| 3.9 | Hive Overview page | Four sections: Hive Header (edit for admin+), Announcements (post form admin+), Deadlines panel ("Add to Calendar" placeholder), Hive Feed (real-time prepend via useRealtimeHive, OG preview cards) | 2d |
| 3.10 | tRPC router: announcements | createAnnouncement (enforceRole admin). getAnnouncements (paginated). deleteAnnouncement (author or admin+) | 0.5d |
| 3.11 | tRPC router: hive materials | shareMaterialToHive (enforceRole member). getHiveMaterials (hive_material_shares JOIN materials, paginated). unshareMaterial (shared_by or admin+) | 0.5d |
| 3.12 | tRPC router: folders | createFolder, getHiveFolders (tree structure), renameFolder, deleteFolder | 0.5d |
| 3.13 | Hive Materials page | Two-panel: folder tree left, material grid right. "Share to Hive" button. OG preview cards. "shared by [name]" caption. Hover overlay with actions. Share to Hive modal (from library/desk tabs) | 1.5d |
| 3.14 | Share to Hive modal | Two tabs: "From my library" (searchable list) + "Add new" (URL or file). Folder selector. "Remove from desk after sharing" checkbox (if from desk). Lifecycle choice at bottom | 0.5d |
| 3.15 | Library "From My Hives" — wire up | getHiveMaterialsForLibrary query. Hive name headers. Material cards with "Copy to my library" in hover overlay | 0.5d |
| 3.16 | Dashboard hive cards — wire up | getUserHives query. HiveCard component. Hover prefetch hive overview. Click → /hive/[id]/overview | 0.5d |
| 3.17 | Hive Settings page | Tabs: General, Members, Sharing, Feed (feed_settings toggles), Danger Zone (delete with hive name re-entry) | 1d |
| 3.18 | Create Hive dialog | Dialog from "New Hive" button. Name, description, course code, color theme picker. Optimistic dashboard grid update | 0.5d |

### Deliverables
- [ ] Full hive CRUD with role enforcement at tRPC + RLS
- [ ] Invite system: generate, accept, revoke, Resend email
- [ ] Hive overview: header, announcements, deadlines, live activity feed
- [ ] Hive materials: share from library/desk, OG preview cards, folder structure
- [ ] Library "From My Hives" section populated
- [ ] Dashboard hive cards with hover prefetch
- [ ] Hive Settings: general, members, sharing, feed config, danger zone

---

## Phase 4 — Tasks, Syllabus & Calendar
**Weeks 9–10**  
*Full task studio with kanban. Per-member syllabus progress. In-app calendar with Add to Calendar.*

### Objectives
- Task Studio: kanban board, task detail modal, material references via global search
- Syllabus: unit/topic tree, per-member progress, admin stats, drag reorder
- Calendar: week/day/month views. "Add to Calendar" with dedup
- My Tasks panel on dashboard fully wired

### Tasks

| # | Task | Implementation Notes | Est. |
|---|---|---|---|
| 4.1 | tRPC router: tasks | createTask (INSERT tasks + task_material_refs + push notification if assignee). updateTask (diff materialIds). deleteTask. getTasks (paginated + filtered). getMyTasks (assignee or personal, sorted due_at). getUpcomingDeadlines | 1.5d |
| 4.2 | Hive Tasks page — Kanban | @dnd-kit DndContext + SortableContext per column. Drag → updateTask({status}) optimistic. Column count badges. Filter bar: assignee, priority, due date | 2d |
| 4.3 | TaskCard component | Priority badge + assignee avatar + title + due date (red if overdue) + material refs chip. Drag handle on hover. Drag state: rotation + shadow | 0.5d |
| 4.4 | TaskDetailModal component | Two-column: left (title editable, description markdown, material refs chips + "Add Reference"). Right sidebar: Status, Priority, Due date picker (@internationalized/date), Assignee dropdown. Cmd+Enter submits | 1.5d |
| 4.5 | Keyboard alternative for drag | TaskCard onKeyDown Enter → "Move to column" Select dialog. Satisfies WCAG | 0.25d |
| 4.6 | Dashboard My Tasks — wire up | getMyTasks query. Task row: hive badge, title, priority, due date (red if overdue). Quick status toggle. "View all" → /calendar | 0.5d |
| 4.7 | tRPC router: syllabus | getSyllabus (units + topics + user completion annotated). createUnit/updateUnit/deleteUnit/reorderUnits. createTopic/updateTopic/deleteTopic/reorderTopics. toggleTopicComplete (UPSERT syllabus_progress). getProgressStats (admin+ only, per-topic counts) | 1d |
| 4.8 | Hive Syllabus page | Overall circular progress top. Per-unit Collapsible accordion + progress bar. Topics: checkbox (optimistic toggle), title (inline edit on click), description, material chip. Completed: strikethrough + muted. @dnd-kit for reordering. Admin badge per topic | 2d |
| 4.9 | Calendar page /calendar | View switcher (Week/Day/Month). Navigation arrows + Today button. Week view: 7 columns, hourly rows 6am–10pm, all-day strip. Task blocks positioned by time, colored by priority, hive badge. Current time red line | 2d |
| 4.10 | tRPC: getCalendarTasks | tasks WHERE (assignee=user OR creator=user) AND due_at BETWEEN start AND end. staleTime: 30s | 0.25d |
| 4.11 | "Add to Calendar" — wire up | addToCalendar tRPC: check dedup (source_ref_id + creator_id). If exists: return alreadyAdded:true. If not: createTask source=hive_deadline. Button shows "Added ✓" if alreadyAdded | 0.5d |
| 4.12 | Task block drag to reschedule | @dnd-kit on calendar. Drop → updateTask({dueAt: newDateTime}) optimistic. Snap to 15min | 0.5d |

### Deliverables
- [ ] Hive Tasks kanban with drag-and-drop and keyboard alternative
- [ ] TaskDetailModal with material references via global search attach mode
- [ ] Hive Syllabus: tree, per-member checkbox, progress bars, admin stats, dnd reorder
- [ ] Calendar: week/day/month views
- [ ] "Add to Calendar" with source_ref_id dedup
- [ ] Dashboard My Tasks fully wired

---

## Phase 5 — PWA, Theming, Push Notifications & Performance
**Weeks 11–13**  
*Multi-theme system. Web Share Target. Push notifications. Offline starred materials. Full SWR + optimistic update layer.*

### Objectives
- Theme system: CSS custom properties, ThemeProvider, SSR flash prevention
- Serwist PWA: manifest, service worker, Web Share Target
- Push notifications: VAPID, Edge Function, triggers, pg_cron deadline reminders
- Explicit offline download for starred file materials
- Full SWR staleTime audit and optimistic updates on every mutation

### Tasks

| # | Task | Implementation Notes | Est. |
|---|---|---|---|
| 5.1 | CSS custom properties theme system | globals.css: [data-theme="x"] blocks. Variables: --color-primary, --color-primary-foreground, --color-background, --color-surface, --color-border, --color-accent, --color-muted, --color-muted-foreground, --radius, --shadow. Tailwind config: extend colors to CSS vars | 0.5d |
| 5.2 | ThemeProvider component | components/ThemeProvider.tsx. Sets data-theme on html element. SSR: read theme from cookie → inline script before React hydration (prevents flash). Listens to prefers-color-scheme for "system" theme | 0.5d |
| 5.3 | tRPC: user preferences | getPreferences, updatePreferences({theme?, defaultCalView?}). On theme change: set cookie in response. Optimistic: Zustand + cookie update immediate, DB write async | 0.25d |
| 5.4 | Theme picker — onboarding + settings | Wire Phase 1 placeholder. Theme preview cards: color circle + bg/surface swatch + name. Selected: ring + checkmark. Instant switch. Settings > Appearance: same grid + "Match system" toggle | 0.5d |
| 5.5 | Serwist PWA setup | @serwist/next in next.config.ts. public/manifest.json: name, display:standalone, icons (192+512+maskable). src/sw.ts: defaultCache (StaleWhileRevalidate), offline-materials cache (CacheFirst). Register SW in root layout | 1d |
| 5.6 | Web Share Target | manifest.json share_target. app/api/share-target/route.ts: parse FormData, detect type, fetchLinkMeta() if URL, INSERT materials + shelf_items (service role), redirect to /desk. Unauthenticated: encrypted cookie → /login → consume in /auth/callback | 1.5d |
| 5.7 | VAPID key generation | npx web-push generate-vapid-keys. VAPID_PRIVATE_KEY → Supabase Edge Function secret. NEXT_PUBLIC_VAPID_PUBLIC_KEY → Vercel env var | 0.25d |
| 5.8 | Push subscription flow | hooks/useNotificationPermission.ts. Request permission → pushManager.subscribe → POST to /api/push/subscribe. Route handler: INSERT push_subscriptions (or UPDATE last_used_at). "Enable notifications" button in settings | 1d |
| 5.9 | iOS PWA onboarding | Detect iOS Safari. Show dismissible banner: add to home screen guide with illustrated steps. Store dismissed in localStorage. Re-show after 7 days | 0.5d |
| 5.10 | Edge Function: send-push-notification | supabase/functions/send-push-notification/index.ts (Deno). Input: {userId, title, body, url, hiveId?}. Check user_hive_preferences — skip if muted. Send Web Push via web-push with VAPID. On 410: DELETE subscription row. Called async from tRPC (fire and forget) | 1d |
| 5.11 | Push notification triggers | createTask + assignee → notify assignee. createAnnouncement → notify all hive members except author. pg_cron: hourly SELECT tasks due within 24h → notify assignee → UPDATE last_reminded_at | 1d |
| 5.12 | Explicit offline download | SW message handler: CACHE_MATERIAL → fetch(url) → cache.put in "offline-materials". Client hook useMaterialCache: sends message, listens for CACHED, updates IndexedDB map. Download button → triggers flow → "Available offline ✓" | 1d |
| 5.13 | SWR staleTime full audit | Audit every useQuery call. Apply staleTime overrides per PRD spec. Document rationale in comment above each query | 0.5d |
| 5.14 | Hover prefetch all nav | Sidebar nav items onMouseEnter → utils.[router].prefetch(). Dashboard hive cards. Library nav. Feed nav | 0.5d |
| 5.15 | Server-side prefetch in major layouts | app/(app)/layout.tsx: getUserHives, getMyTasks, getStarredMaterials. app/(app)/hive/[id]/layout.tsx: getHive, getHiveOverview, getHiveMembers. createCaller + dehydrate + HydrationBoundary | 0.5d |
| 5.16 | Optimistic updates — full audit | Apply to every remaining mutation: createHive, updateHive, deleteHive, createAnnouncement, changeRole, acceptInvite, shareMaterialToHive, unshareMaterial, createFolder, createTask, updateTask, deleteTask, toggleTopicComplete, all syllabus CRUD,