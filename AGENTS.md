# Strizzle — Agent Instructions

> This file is read by every AI agent spawned in this workspace before starting any task.
> It is the single source of truth for how agents should behave, what they must never do,
> and how the codebase is structured. Read it fully before writing any code.

---

## Project Identity

**Strizzle** — A personal study platform. Individual-first, hive-enhanced.
Greenfield build. No V1 code exists. No migration burden. Build it right from day one.

**Core Philosophy:** The app must be fully useful to a solo student who has never joined a hive.
Hives are an upgrade, not a prerequisite.

---

## Tech Stack (non-negotiable)

```
Framework        Next.js 16 (App Router, Turbopack)
Language         TypeScript strict + @total-typescript/ts-reset
Styling          Tailwind CSS + shadcn/ui (CSS variables mode)
Animation        Framer Motion
Server state     TanStack Query via tRPC
Client state     Zustand
API              tRPC + Zod
Database         Supabase Postgres + Drizzle ORM
Auth             Supabase Auth
Storage          Supabase Storage (content-addressable, SHA-256)
Search           Postgres FTS (tsvector + GIN + plainto_tsquery)
Realtime         Supabase Realtime
Email            Resend
Rate limiting    Upstash Redis
PWA              Serwist (@serwist/next)
Push             web-push (Supabase Edge Functions) + pg_cron
Drag-and-drop    @dnd-kit/core + @dnd-kit/sortable
Forms            react-hook-form + @hookform/resolvers/zod
Date math        @internationalized/date
Toasts           Sonner
Testing          Playwright (E2E) + Vitest (unit)
Error tracking   Sentry
Dead code        knip
Deploy           Vercel
```

Do not introduce any library not on this list without explicit approval.
Do not suggest switching any of these. The decisions are final.

---

## Absolute Rules — Never Violate These

### Database
- **NEVER** modify the production Supabase project. All DB work targets staging (`.env.local`).
- **NEVER** write raw SQL inside tRPC procedures or application code.
  Raw SQL belongs only in `db/migrations/` files (for triggers and functions).
  All queries use Drizzle ORM.
- **NEVER** commit a migration that adds a table without RLS enabled and policies written.
  The order is always: CREATE TABLE → ENABLE RLS → CREATE POLICIES → then and only then commit.
- **NEVER** edit a migration file that has already been committed. Create a new one.

### TypeScript
- **NEVER** use `any`. If a type is unknown, use `unknown` and narrow it.
  If a type is complex, define it in `src/types/`.
- **NEVER** use `// @ts-ignore` or `// @ts-expect-error` without a comment explaining why
  and a TODO to fix it properly.

### Security
- **NEVER** commit `.env` files, API keys, or secrets to the codebase.
- **NEVER** use the `service_role` Supabase key in client components or client-side code.
  It belongs only in server-side route handlers and Edge Functions.
- **NEVER** skip `enforceRole()` in a hive-scoped tRPC procedure.
  Every procedure that touches hive data must call `await enforceRole(ctx, minRole, hiveId)`.
- **NEVER** expose the VAPID private key. It lives only as a Supabase Edge Function secret.

### Material System
- **NEVER** cascade deletes from `materials` to `hive_material_shares`.
  Every shared or copied material instance is fully independent.
- **NEVER** change `materials.owner_id` after creation. Ownership is permanent.
- **NEVER** delete a file from Supabase Storage directly from application code.
  File deletion is handled exclusively by the `delete-storage-object` Edge Function,
  triggered by the `storage_objects.ref_count` Postgres trigger reaching zero.

### Performance
- **NEVER** add a full-page loading spinner for a page the user has visited before.
  Returning visits always show cached data instantly. Use skeletons only on first-ever load.
- **NEVER** write a mutation without an optimistic update.
  Every mutation needs: `onMutate` (snapshot + setData) → `onError` (rollback + toast).
- **NEVER** forget `staleTime` on a new `useQuery` call.
  Every query must have an explicit `staleTime` override matching the table below.

---

## staleTime Reference

| Query Type | staleTime | Examples |
|---|---|---|
| High-frequency live data | 30 000 ms | hive overview, calendar, shared feed |
| Standard data | 120 000 ms | materials list, task list, hive members |
| Slow-changing data | 300 000 ms | syllabus tree, hive settings |
| User session data | 900 000 ms | profile, user_preferences |
| Search | 0 | globalSearch — always fresh |

---

## Directory Structure

```
src/
  app/
    (auth)/              → /login /register /onboarding /auth/callback
    (app)/               → authenticated pages, uses shell layout
      dashboard/
      desk/
      library/
      calendar/
      feed/
      settings/
      hive/[hiveId]/
        overview/
        materials/
        tasks/
        syllabus/
        settings/
    api/
      trpc/[trpc]/       → tRPC route handler
      share-target/      → Web Share Target POST handler
      push/subscribe/    → push subscription registration
  server/
    trpc.ts              → context, createTRPC, publicProcedure, protectedProcedure, enforceRole
    routers/             → one file per router (see Router Map below)
    email/               → Resend React Email templates
    lib/
      logActivity.ts
      fetchLinkMeta.ts
  db/
    schema.ts            → all 22 Drizzle table definitions + pgEnums
    index.ts             → Drizzle client
    migrations/          → SQL files, named NNNN_description.sql
  components/
    ui/                  → shadcn components — DO NOT MODIFY
    GlobalSearch.tsx
    QuickAddModal.tsx
    DeskActionModal.tsx
    TaskDetailModal.tsx
    ThemeProvider.tsx
    MaterialCard.tsx
    TaskCard.tsx
    FeedItem/            → AnnouncementFeedItem, MaterialFeedItem, DeadlineFeedItem, ActivityFeedItem
  hooks/
    useRealtimeHive.ts
    useNotificationPermission.ts
    useMaterialCache.ts
    useTheme.ts
  lib/
    hashFile.ts          → SHA-256 client-side file hashing
    fetchLinkMeta.ts     → OpenGraph + oEmbed fetcher (server-side)
    trpc/                → client.ts, provider.tsx
    supabase/            → client.ts (browser), server.ts (RSC), middleware.ts
  store/
    hiveStore.ts         → currentHiveId, userRole
    notificationStore.ts → unreadCount, increment, reset
    themeStore.ts        → currentTheme, setTheme
  types/                 → shared TypeScript interfaces
  sw.ts                  → Serwist service worker
supabase/
  functions/             → Deno Edge Functions
    send-push-notification/
    delete-storage-object/
tests/
  e2e/                   → Playwright test files
public/
  manifest.json
  icons/
```

---

## Router Map

| Router file | Procedures |
|---|---|
| `user.ts` | getMe, updateProfile, getPreferences, updatePreferences |
| `hive.ts` | createHive, getHive, getUserHives, updateHive, deleteHive |
| `member.ts` | getHiveMembers, changeRole, removeMember, leaveHive |
| `invite.ts` | generateInviteLink, revokeInvite, acceptInvite, listInvites |
| `announcement.ts` | createAnnouncement, getAnnouncements, deleteAnnouncement |
| `activity.ts` | getHiveActivity, getFeed |
| `material.ts` | createTextMaterial, createLinkMaterial, checkStorageObject, getPresignedUploadUrl, confirmFileUpload, getMaterials, updateMaterial, deleteMaterial, copyMaterial |
| `shelf.ts` | createShelfItem, getShelfItems, deleteShelfItem, moveToLibrary |
| `library.ts` | getLibraryMaterials, getHiveMaterialsForLibrary, addToLibrary, starMaterial, unstarMaterial, getStarredMaterials |
| `hiveMaterial.ts` | shareMaterialToHive, getHiveMaterials, unshareMaterial |
| `folder.ts` | createFolder, getHiveFolders, renameFolder, deleteFolder |
| `task.ts` | createTask, updateTask, deleteTask, getTasks, getMyTasks, getUpcomingDeadlines, addToCalendar |
| `syllabus.ts` | getSyllabus, createUnit, updateUnit, deleteUnit, reorderUnits, createTopic, updateTopic, deleteTopic, reorderTopics, toggleTopicComplete, getProgressStats |
| `calendar.ts` | getCalendarTasks |
| `notification.ts` | getNotifications, markRead, markAllRead, getUnreadCount |
| `search.ts` | globalSearch |
| `push.ts` | registerSubscription, unregisterSubscription |
| `hivePreference.ts` | updateHivePreference, getHivePreferences |

All routers assembled in `server/routers/root.ts`.

---

## Code Conventions

### File naming
- Pages: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` (Next.js conventions)
- Components: `PascalCase.tsx`
- Utilities, hooks, stores: `camelCase.ts`
- tRPC routers: `camelCase.ts` (matches the router name in root.ts)

### Component conventions
- Client components that use hooks must have `'use client'` at the top
- Server components fetch data via tRPC server caller or Supabase server client — no client hooks
- Shared Zod schemas are exported from the router file and imported into form components

### Styling conventions
- Tailwind utility classes only — no inline styles, no CSS Modules, no styled-components
- All color references must use CSS variable-based Tailwind classes:
  `bg-primary`, `text-primary-foreground`, `bg-background`, `bg-surface`, `border-border`
  Never hardcode a hex color in a className
- Theme-agnostic: any component must look correct in all available themes

### State conventions
- Server state (anything from the DB): TanStack Query via tRPC
- Local UI state (modal open, tab selected, form input): `useState`
- Cross-component client state (notification count, current theme, current hive): Zustand store
- Never put server-fetched data into Zustand — that's what TanStack Query is for

### Error handling conventions
- tRPC errors: use `TRPCError` with appropriate code (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`)
- Mutation errors: always show `toast.error(message)` in `onError`
- Unexpected server errors: `Sentry.captureException(err)` then re-throw
- Never show raw error messages from the server to the user — map them to friendly strings

---

## Core Abstractions & Shared Practices

### Shared UI Components
Avoid duplicate UI components or writing native modals/confirmations. Always use:
- **`ConfirmModal` & `useConfirmStore`**: Never use native `window.confirm` or write local dialog states for actions requiring confirmation. Call `const confirmed = await confirm({ title: 'Remove...', description: '...', variant: 'destructive' })` from `@/store/confirmStore`.
- **`DropdownSelect`**: Always use this component (which wraps shadcn select) for form input selects, ensuring consistent styling (`h-9.5`, `rounded-xl`, `bg-card`, etc.).
- **`Brand`**: Use this component (`@/components/Brand`) for displaying the Strizzle brand icon and text consistently.
- **`QuickAddModal`**: Use this modal for adding text notes, links, or files quickly from the navigation/dashboard.

### Animation & Framer Motion Guidelines
A premium UI requires motion on interactive elements. Follow these guidelines:
- **Card/Item Transitions**: Card elements (like shelf or library items) should fade and slide up when mounting:
  `initial={{ opacity: 0, y: 12 }}` or `scale: 0.95`, `animate={{ opacity: 1, y: 0 }}` or `scale: 1`.
- **Hover Micro-Animations**: Use subtle translate effects on hover to denote interactivity:
  `whileHover={{ y: -4 }}` or `whileHover={{ y: -3 }}`.
- **Standard Transition Parameters**: Use a standard Expo transition:
  `transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}` (easeOutExpo cubic-bezier).
- **Exit Animations & Layout Reordering**: When items in a grid/list are added, deleted, or reordered dynamically, wrap them in a `<motion.div layout>` container and use `<AnimatePresence mode="popLayout">` with corresponding `layout` and `exit` attributes on the item divs.

### Keyboard & Modal Accessibility
- **`useModalKeybinds`**: Every modal or creation dialog containing input forms must import and call `useModalKeybinds(isOpen, onSubmit)` to allow the user to submit by pressing `Enter`.
- The hook will automatically check focused elements and avoid submitting if the user is focused on inputs that natively handle enter keypresses (such as `TEXTAREA`, `BUTTON`, elements with `contenteditable`, or Radix `combobox`/`listbox` selectors).
- Always expose a `resetForm()` helper in form modals to clean up internal state on modal close.

### Drag & Drop (Dnd Kit) Guidelines
When implementing drag-and-drop lists or boards (e.g. syllabus reordering, task board):
- **Pointer Sensor Constraint**: Always specify an activation distance constraint on the Pointer Sensor to prevent clicks/taps from being misidentified as drag starts:
  ```typescript
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  ```
- **Keyboard Access**: Always support keyboard drag-and-drop using `KeyboardSensor` with `coordinateGetter: sortableKeyboardCoordinates`.

### Content-Addressable Storage & Hashing
- Before uploading files to Supabase Storage, always calculate a SHA-256 hex checksum of the file content on the client side using the helper `hashFile(file)` from `@/lib/hashFile.ts`.
- This hash is used by the backend to dedup files, track references (`storage_objects.ref_count`), and implement content-addressable storage.

### Service Worker & Offline Caching
- **`useMaterialCache` Hook**: Any component displaying materials must use the custom hook `useMaterialCache()` to communicate with the Serwist service worker (`sw.ts`).
- Check if an item is cached locally using `isCached(material.storagePath)` and trigger downloads to the local offline cache using `downloadMaterial(material.id, fileUrl)`.

### YouTube Integration Utilities
- When extracting durations or parsing playlist indices, always use the helper functions in `@/lib/youtube.ts`:
  - `parseVideoRange(rangeStr, maxCount)`: Parses a range string (e.g., `"1-5, 8"`) into a Set of indices.
  - `parseISO8601Duration(durationStr)`: Formats ISO 8601 duration string into seconds.
  - `fetchYoutubeVideoDurationWithoutKey(url)`: Scrapes video pages to fetch duration without requiring a YouTube API key.

---

## RBAC Reference

```
owner > admin > member > viewer
```

| Operation | Minimum Role |
|---|---|
| View hive content | viewer |
| Upload / share material | member |
| Create task | member |
| Update syllabus | member |
| Post announcement | admin |
| Manage members and roles | admin |
| Configure feed settings | admin |
| Generate / revoke invite links | admin |
| Edit hive details | admin |
| Delete hive | owner |
| Transfer ownership | owner |

Always use `enforceRole(ctx, 'member', hiveId)` — not manual role comparisons.

---

## Material System Rules (Repeat for Emphasis)

```
materials.owner_id       → set at creation, never changes
materials DELETE         → cascades to shelf_items + library_materials (same user only)
                           does NOT cascade to hive_material_shares
                           does NOT cascade to other users' library_materials
hive_material_shares     → independent lifecycle, only dies when:
                           (a) hive is deleted (ON DELETE CASCADE from hives)
                           (b) explicitly removed by sharer or admin
storage_objects.ref_count → decremented by trigger on materials DELETE
                           when ref_count = 0 → Edge Function deletes file from bucket
```

Copying a material = new `materials` row (new id, new owner) + increment `ref_count` if file.

---

## Database Checklist (Before Committing Any Migration)

```
[ ] Table created with all columns and correct types
[ ] Primary key defined (uuid, default gen_random_uuid())
[ ] created_at and updated_at columns present
[ ] Foreign keys with explicit ON DELETE behaviour defined
[ ] Row Level Security ENABLED on the table
[ ] SELECT policy written and tested
[ ] INSERT policy written and tested
[ ] UPDATE policy written and tested (if applicable)
[ ] DELETE policy written and tested (if applicable)
[ ] All necessary indexes created (BTREE for lookups, GIN for tsvector)
[ ] tsvector trigger added if the table is searchable
[ ] Verified via Supabase MCP that migration applied correctly
[ ] Verified RLS blocks access from a second test user where expected
```

---

## Optimistic Update Template

Copy this pattern for every new mutation:

```typescript
const mutation = api.[router].[procedure].useMutation({
  onMutate: async (input) => {
    // Cancel inflight queries that would overwrite the optimistic update
    await utils.[router].[query].cancel(/* query input */);

    // Snapshot for rollback
    const previous = utils.[router].[query].getData(/* query input */);

    // Apply optimistic update
    utils.[router].[query].setData(/* query input */, (old) => {
      if (!old) return old;
      // ... transform old data to reflect the mutation
      return { ...old };
    });

    return { previous };
  },

  onError: (_err, _input, ctx) => {
    // Roll back to snapshot
    if (ctx?.previous !== undefined) {
      utils.[router].[query].setData(/* query input */, ctx.previous);
    }
    toast.error('Something went wrong. Please try again.');
  },

  onSuccess: () => {
    // Invalidate only the affected queries
    utils.[router].[query].invalidate(/* query input */);
  },
});
```

---

## Skeleton Screen Rules

- Skeleton components must match the real content dimensions exactly
  (same height, same grid layout, same number of items)
- Use `<Skeleton className="..." />` from shadcn for all placeholder blocks
- Show skeletons via `loading.tsx` files in the App Router, not conditional rendering
- Never show a skeleton on a page the user has already visited — SWR handles that

---

## When Starting Any Task

1. Identify which tables are involved — check `db/schema.ts`
2. Identify which tRPC router the new procedure belongs in — check the Router Map above
3. If a new table is needed: write the migration first, verify RLS, then write the procedure
4. Write the tRPC procedure with Zod input schema
5. Write the UI component
6. Add the optimistic update to the mutation
7. Add the correct `staleTime` to the query
8. Run `npx tsc --noEmit` — must show zero errors
9. Confirm the mutation has a rollback path by temporarily making it fail

---

## When Writing a tRPC Procedure

```typescript
// server/routers/example.ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { enforceRole } from '../trpc';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { materials } from '@/db/schema';

export const exampleInputSchema = z.object({
  hiveId: z.string().uuid(),
  title: z.string().min(1).max(200),
});

export const exampleRouter = createTRPCRouter({
  createSomething: protectedProcedure
    .input(exampleInputSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Enforce role first — before any DB reads
      await enforceRole(ctx, 'member', input.hiveId);

      // 2. Business logic using Drizzle
      const [result] = await ctx.db
        .insert(materials)
        .values({ ownerId: ctx.user.id, ...input })
        .returning();

      if (!result) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // 3. Log activity (for hive events)
      await logActivity(ctx.db, {
        hiveId: input.hiveId,
        actorId: ctx.user.id,
        actionType: 'material_created',
        entityType: 'material',
        entityId: result.id,
      });

      return result;
    }),
});
```

---

## When Writing a Migration

```sql
-- db/migrations/NNNN_description.sql

-- 1. Create table
CREATE TABLE IF NOT EXISTS example_table (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS immediately
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;

-- 3. Write policies
CREATE POLICY "users_own_rows_select" ON example_table
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_own_rows_insert" ON example_table
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_own_rows_update" ON example_table
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "users_own_rows_delete" ON example_table
  FOR DELETE USING (user_id = auth.uid());

-- 4. Indexes
CREATE INDEX idx_example_table_user_id ON example_table(user_id);

-- 5. tsvector trigger (if this table is searchable)
ALTER TABLE example_table ADD COLUMN search_vec TSVECTOR;

CREATE FUNCTION update_example_search_vec() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vec := to_tsvector('english', coalesce(NEW.name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER example_search_vec_update
  BEFORE INSERT OR UPDATE OF name
  ON example_table
  FOR EACH ROW EXECUTE FUNCTION update_example_search_vec();

CREATE INDEX idx_example_table_search ON example_table USING GIN(search_vec);
```

---

## Commit Message Format

```
type(scope): short description

Types: feat | fix | chore | refactor | test | docs | perf
Scope: matches the phase task number or router/component name

Examples:
  feat(material): add SHA-256 dedup check before upload
  feat(shelf): implement desk action modal lifecycle choices
  fix(rls): add missing UPDATE policy on hive_material_shares
  perf(dashboard): add hover prefetch on hive cards
  test(e2e): add desk capture and share to hive test
  chore(schema): migration 003 - add push_subscriptions table
```

---

## MCP Servers Available

| Server | Use For |
|---|---|
| Supabase MCP | Verify migrations applied, check RLS policies, inspect schema, run SQL queries against staging |
| GitHub MCP | Create branches, open PRs, read issues |
| Playwright MCP | Run E2E tests, take screenshots, verify UI at different viewport sizes |
| Filesystem MCP | Read files outside the workspace if needed |

Always use Supabase MCP to verify a migration applied correctly before marking a task done.
Always use Playwright MCP to verify UI at 375px (mobile) and 1280px (desktop) before marking a task done.

---

## Re-Priming Between Sessions

At the end of a long session or when switching features, generate a handoff summary:

```
Summarise the current state of Strizzle in a dense format:
- What phase we are in and which tasks are done
- Current db/schema.ts table count and any new tables added this session
- tRPC routers that exist and their key procedures
- Any open issues or TODOs that must be addressed next session
- The exact next task to pick up
```

Paste this summary at the start of the next session to restore full context.
