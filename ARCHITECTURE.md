# StudyHive V2 — Architecture Reference

> Last updated: June 2026  
> This document is the single source of truth for every architectural decision in the codebase. Read it before writing any new feature, router, or component.

---

## Stack at a Glance

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | RSC, server prefetch, proxy.ts auth middleware, Vercel edge |
| Language | TypeScript strict + @total-typescript/ts-reset | No `any`, narrowed types everywhere |
| Styling | Tailwind CSS + shadcn/ui (CSS vars mode) | Theme system via CSS custom properties |
| Animation | Framer Motion | Mount/unmount animations, AnimatePresence |
| Server state | TanStack Query via tRPC | SWR caching, optimistic updates, type-safe |
| Client state | Zustand | Notification count, current hive, theme, offline cache state |
| API | tRPC + Zod | End-to-end type safety, shared validation schemas |
| Database | Supabase Postgres + Drizzle ORM | Edge-compatible ORM, Supabase free tier |
| Auth | Supabase Auth | Email, Google OAuth, magic link, JWT |
| Storage | Supabase Storage | Content-addressable (SHA-256), ref-counted |
| Search | Postgres FTS | tsvector + GIN + plainto_tsquery |
| Realtime | Supabase Realtime | postgres_changes for activity feed + notification badge |
| Email | Resend | Invite emails, 3k/month free |
| Rate limiting | Upstash Redis | Search, invites, share-target endpoint |
| PWA | Serwist (@serwist/next) | Web Share Target, push notifications, offline cache |
| Push | web-push (Edge Functions) + pg_cron | VAPID, deadline reminders |
| Drag-and-drop | @dnd-kit | Kanban, syllabus reorder |
| Forms | react-hook-form + @hookform/resolvers/zod | Zod shared between client validation and tRPC |
| Date math | @internationalized/date | Calendar UI, timezone-aware, locale-aware |
| Toasts | Sonner | shadcn-compatible |
| Testing | Playwright (E2E) + Vitest (unit) | |
| Error tracking | Sentry | Source maps, Edge Function errors |
| Analytics | Vercel Analytics + Speed Insights | Custom events |
| Dead code | knip | Runs in CI |
| Deploy | Vercel free tier | |

---

## The Material System

This is the most important architectural concept in the app. Read carefully.

### Core Principle
**Every material is owned by exactly one user. Ownership never changes.**

A material is not "in a hive." It is shared *into* a hive. These are different things.

### Three Location Tables

A material can exist in up to three places simultaneously:

```
shelf_items        → material is on the user's desk (temporary)
library_materials  → material is in the user's permanent library
hive_material_shares → material is published into a hive
```

Deleting a location row never affects the material row itself. The material is only deleted when the owner explicitly deletes it via `deleteMaterial`.

### Cascade Rules — Critical

```
materials DELETE → cascades to:
  ✓ shelf_items (owner's own shelf entry)
  ✓ library_materials (owner's own library entry)
  ✗ hive_material_shares — NO CASCADE (independent)
  ✗ other users' library_materials — NO CASCADE (independent copies)
```

**When owner deletes a material:**
- Disappears from their desk and library
- Does NOT disappear from any hive it was shared to
- Does NOT affect any other user's copy
- Optional: "Also remove from hives you shared it to" checkbox (unchecked by default)
- The actual storage file is only deleted when storage_objects.ref_count reaches 0

### File Deduplication (SHA-256)

```
Upload flow:
1. Browser: hashFile(file) → SHA-256 hex + size
2. tRPC: checkStorageObject({hash}) → {exists, storagePath?}
3a. If exists: skip upload, reuse storagePath, increment ref_count
3b. If not exists: getPresignedUploadUrl → client uploads → confirmFileUpload
4. INSERT materials row with storage_ref_id = hash
```

```
Delete flow:
1. DELETE materials row (owner only)
2. Postgres trigger fires: UPDATE storage_objects SET ref_count = ref_count - 1
3. If ref_count = 0: trigger calls Edge Function → deletes file from bucket
```

### Copying a Material

When user B copies a material (from a hive or another user's share):
1. New `materials` row created with `owner_id = user B`
2. If file: `storage_objects.ref_count` incremented, same `storage_path` reused
3. New `library_materials` row created for user B

User B now owns an independent copy. User A deleting their copy has zero effect on user B.

---

## tRPC Patterns

### Context Shape

```typescript
// server/trpc.ts
interface TRPCContext {
  user: User | null;        // from Supabase session
  db: DrizzleClient;        // Drizzle ORM instance
  supabase: SupabaseClient; // for storage, auth operations
}
```

### Procedure Types

```typescript
publicProcedure    // no auth check — used for: login, register, invite acceptance
protectedProcedure // throws UNAUTHORIZED if no session
```

### enforceRole

```typescript
// Always call this inside hive-scoped procedures, not in the router definition
await enforceRole(ctx, 'member', hiveId);
// Hierarchy: owner > admin > member > viewer
// Throws FORBIDDEN if user's role is below the minimum
```

### Router File Convention

One file per router in `server/routers/`. Each file exports a single `createTRPCRouter({...})`. All sub-routers are assembled in `server/routers/root.ts`.

### Input Validation

Every procedure has a Zod schema on `.input()`. Never skip this. The same schema is importable on the client for form validation:

```typescript
// server/routers/material.ts
export const createLinkMaterialSchema = z.object({
  url: z.string().url(),
  tags: z.array(z.string()).default([]),
});

// components/AddLinkModal.tsx
import { createLinkMaterialSchema } from '@/server/routers/material';
const form = useForm({ resolver: zodResolver(createLinkMaterialSchema) });
```

---

## Data Fetching Patterns

### Global QueryClient Config

```typescript
// providers.tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2 minutes default
      gcTime:    1000 * 60 * 10,  // 10 minutes
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
})
```

### Per-Query staleTime Overrides

| Query | staleTime | Reason |
|---|---|---|
| Hive overview, calendar, shared feed | 30s | Changes frequently |
| Materials list, task list | 2min | Moderate change rate |
| Syllabus tree | 5min | Rarely changes mid-session |
| User profile, user preferences | 15min | Almost never changes |
| Global search | 0 | Always fresh |

### Stale-While-Revalidate in Practice

**Rule: if the user has seen this data before, they never see a loading state when returning to it.**

1. First visit: skeleton screen → data loads → skeleton replaced
2. Return visit: cached data renders immediately → silent background refetch → UI updates if changed
3. Never show a spinner for a full-page load on a page the user has visited before

### Server-Side Prefetch (React Server Components)

```typescript
// app/(app)/hive/[hiveId]/layout.tsx
export default async function HiveLayout({ params, children }) {
  const caller = createCaller(await createContext());
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: [['hive', 'getHive'], { input: { hiveId: params.hiveId } }],
      queryFn: () => caller.hive.getHive({ hiveId: params.hiveId }),
    }),
    // ... other prefetches
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
```

### Hover Prefetch

```typescript
// In any navigation component
const utils = api.useUtils();

<NavItem
  onMouseEnter={() => {
    utils.material.getMaterials.prefetch({ hiveId });
  }}
/>
```

---

## Optimistic Update Pattern

**Every mutation must have an optimistic update.** No exceptions.

```typescript
const mutation = api.material.starMaterial.useMutation({
  onMutate: async (input) => {
    // 1. Cancel inflight queries that would overwrite our optimistic update
    await utils.library.getStarredMaterials.cancel();

    // 2. Snapshot current data for rollback
    const previous = utils.library.getLibraryMaterials.getData();

    // 3. Apply optimistic update immediately
    utils.library.getLibraryMaterials.setData(undefined, (old) =>
      old ? { ...old, items: old.items.map(m =>
        m.id === input.materialId ? { ...m, starred: true } : m
      )} : old
    );

    return { previous }; // returned as ctx in onError
  },

  onError: (err, input, ctx) => {
    // 4. Roll back to snapshot on error
    if (ctx?.previous) {
      utils.library.getLibraryMaterials.setData(undefined, ctx.previous);
    }
    toast.error('Failed to star material. Please try again.');
  },

  onSuccess: () => {
    // 5. Optionally invalidate to get server-confirmed data
    // For simple flag toggles this is often not needed
    utils.library.getStarredMaterials.invalidate();
  },
});
```

---

## Authentication & Security

### Middleware (proxy.ts)

```typescript
// Runs on every request before it reaches the page
// Protects all routes under /app/*
// Refreshes expired sessions automatically
export default async function proxy(request: NextRequest) {
  const supabase = createServerClient(/* cookies */);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session && request.nextUrl.pathname.startsWith('/app')) {
    const returnUrl = request.nextUrl.pathname;
    return NextResponse.redirect(new URL(`/login?returnUrl=${returnUrl}`, request.url));
  }
  // ...
}
```

### RBAC — Two Layers

```
Layer 1: tRPC procedure
  enforceRole(ctx, 'member', hiveId)
  → fast check in application code
  → throws FORBIDDEN with a clear message

Layer 2: Supabase RLS
  → enforced at the database level
  → cannot be bypassed by application bugs
  → defense in depth
```

Never rely on only one layer.

### RLS Policy Conventions

```sql
-- Pattern for hive-scoped tables:
CREATE POLICY "hive_members_select" ON announcements
  FOR SELECT USING (
    hive_id IN (
      SELECT hive_id FROM hive_members
      WHERE user_id = auth.uid()
    )
  );
```

---

## Realtime

### useRealtimeHive Hook

Mount this hook in `app/(app)/hive/[hiveId]/layout.tsx` so it's active across all hive pages.

```typescript
// hooks/useRealtimeHive.ts
export function useRealtimeHive(hiveId: string) {
  const utils = api.useUtils();
  const addNotification = useNotificationStore(s => s.increment);
  const { user } = useUser();

  useEffect(() => {
    const channel = supabase
      .channel(`hive:${hiveId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log',
        filter: `hive_id=eq.${hiveId}`,
      }, (payload) => {
        // Prepend to cache — no network request
        utils.activity.getHiveActivity.setData({ hiveId }, (old) =>
          old ? { ...old, items: [payload.new, ...old.items] } : old
        );
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`,
      }, () => {
        addNotification();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hiveId, user?.id]);
}
```

---

## Theme System

### CSS Custom Properties

```css
/* globals.css */
:root {
  /* default theme vars */
}

[data-theme="ocean"] {
  --color-primary: /* designer value */;
  --color-primary-foreground: /* designer value */;
  --color-background: /* designer value */;
  /* ... all vars */
}
```

### ThemeProvider

```typescript
// Set on <html> element before hydration to prevent flash
// Initial value read from cookie set when user saves preference
// "system" value: listens to prefers-color-scheme MediaQueryList
```

### Adding a New Theme

1. Add the theme key to the `theme` column enum in `user_preferences` Drizzle schema
2. Add a `[data-theme="newkey"]` block in `globals.css` with all CSS var values
3. Add the preview card to the theme picker component
4. No other code changes needed — all shadcn components inherit automatically

---

## PWA & Service Worker

### Serwist Configuration

```typescript
// next.config.ts
import withSerwist from '@serwist/next';
export default withSerwist({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})(nextConfig);
```

### Offline Materials Cache

```typescript
// Service worker message handler
self.addEventListener('message', async (event) => {
  if (event.data.type === 'CACHE_MATERIAL') {
    const cache = await caches.open('offline-materials');
    const response = await fetch(event.data.url);
    await cache.put(event.data.url, response);
    event.source.postMessage({ type: 'CACHED', materialId: event.data.materialId });
  }
});
```

Client updates IndexedDB map `{materialId: boolean}` on CACHED message. This map is read on library page load to show "Available offline ✓" badges.

### Web Share Target

Route handler at `/api/share-target` receives OS share payloads. Uses service role key (not user's session) to create the materials + shelf_items rows server-side, then redirects to `/desk`.

---

## Database Conventions

### Migration Files

- Location: `db/migrations/`
- Naming: `NNNN_short_description.sql`
- Contains: Drizzle-generated DDL + hand-written triggers and functions
- **Never edit a committed migration file** — create a new one

### Triggers (hand-written SQL in migration files)

Three tsvector triggers: `materials`, `tasks`, `syllabus_topics`  
One ref_count trigger: `storage_objects` (fires on materials DELETE)

### Indexes

All GIN indexes: `materials.search_vec`, `tasks.search_vec`, `syllabus_topics.search_vec`  
All critical BTREE indexes: see Phase 1 task 1.9 in the Dev Plan for the full list.

### Enums

All enums defined as `pgEnum` in `db/schema.ts`:
`hive_role`, `material_type`, `task_status`, `task_priority`, `task_source`, `feed_weight`, `notification_type`

---

## Folder Conventions

| Path | Contents |
|---|---|
| `src/app/(auth)/` | Login, register, onboarding, auth/callback — no layout shell |
| `src/app/(app)/` | All authenticated pages — uses the layout shell |
| `src/server/routers/` | One file per tRPC router |
| `src/server/lib/` | `logActivity`, `fetchLinkMeta`, `sendPushNotification` helper |
| `src/server/email/` | Resend templates (React Email) |
| `src/components/ui/` | shadcn components — do not modify |
| `src/components/` | App-specific shared components |
| `src/hooks/` | Custom React hooks |
| `src/store/` | Zustand stores — one file per domain |
| `src/lib/` | Pure utilities: `hashFile`, tRPC client setup, Supabase client |
| `src/types/` | Shared TypeScript types and Zod schemas |
| `supabase/functions/` | Edge Functions (Deno) |
| `tests/e2e/` | Playwright E2E test files |

---

## Common Mistakes to Avoid

| Mistake | Correct Approach |
|---|---|
| Using `any` | Define the type or use `unknown` and narrow |
| Writing raw SQL in tRPC procedures | Use Drizzle ORM. Raw SQL only in migration files |
| Adding a new table without RLS | Enable RLS + write policies before committing the migration |
| Forgetting optimistic update on a mutation | Every mutation needs onMutate → snapshot → setData → onError rollback |
| Using a spinner for a returning user | Cached data renders instantly. Skeletons only on first-ever load |
| Skipping enforceRole in a hive procedure | Call enforceRole at the top of every hive-scoped procedure |
| Cascading deletes across ownership boundaries | materials DELETE never cascades to hive_material_shares or other users' library rows |
| Importing server-only code in client components | Use `import 'server-only'` guard in files that use service_role key or direct DB access |
