# Strizzle: Personal Study and Collaboration Platform

Strizzle is a production-grade personal study companion and collaborative learning platform. It is designed to help students capture notes, organize resources, and coordinate with study groups within a unified, desktop-first workspace.

## Product Vision and Philosophy

### Problem Statement
Modern students manage their academic workloads across multiple disconnected tools: university learning management systems (LMS) for assignments, group messaging services for coordination, cloud storage drives for files, note-taking apps, calendar planners, and separate browsers for research. This fragmentation leads to lost materials, missed deadlines, and disjointed academic coordination.

### The Individual-First Principle
Strizzle is designed on the principle that a study platform must be highly useful to a solo student from the moment they sign up, without requiring them to join a group. Personal features like the Desk Shelf and Private Library are completely self-sufficient. Collaborative workspaces, known as Hives, act as a voluntary upgrade to layer classmate communication, shared resources, task boards, and collective syllabus tracking on top of the student's personal workspace.

---

## Information Architecture

### Global Navigation
* **Dashboard (/dashboard):** Offers a high-level view of joined Hives, starred materials, pending personal and group tasks, and quick-action shortcuts.
* **Desk (/desk):** Temporary scratchpad inbox for quick captures of notes, links, and documents.
* **Library (/library):** Permanent repository containing both privately archived documents and shared resources from joined Hives.
* **Calendar (/calendar):** Grid-based view (Month, Week, Day) aggregating all personal and group task deadlines.
* **Feed (/feed):** Unified chronological update stream across all joined Hives.
* **Settings (/settings):** User profile details, theme settings, notifications preferences, and device configurations.

### Hive Navigation
* **Overview (/hive/[id]/overview):** Landing page for a study group containing Announcements, Deadline lists, and the Hive activity feed.
* **Materials (/hive/[id]/materials):** Shared resource folder system organized hierarchically.
* **Tasks (/hive/[id]/tasks):** Kanban board containing collaborative task cards.
* **Syllabus (/hive/[id]/syllabus):** Collaborative units-and-topics progress tree with completion checkboxes.
* **Settings (/hive/[id]/settings):** Management for members, roles, invite links, and workspace configurations.

---

## Directory Structure

The project codebases are organized as follows:

```
src/
  app/
    (auth)/              - Auth pages (/login, /register, /onboarding, /auth/callback)
    (app)/               - Authenticated application views utilizing shell layouts
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
      trpc/[trpc]/       - tRPC router endpoints handler
      share-target/      - PWA Web Share Target post receiver
      push/subscribe/    - Web push notification subscription registration
  server/
    trpc.ts              - Core contexts, procedure builders, role enforcement helpers
    routers/             - Modularized endpoints per business logic domain
    email/               - Transactional Resend React Email templates
    lib/
      logActivity.ts
      fetchLinkMeta.ts
  db/
    schema.ts            - All Drizzle table structures and PostgreSQL enum typings
    index.ts             - Database connections builder
    migrations/          - Incremental SQL migration scripts
  components/
    ui/                  - UI components (shadcn based library)
    GlobalSearch.tsx
    QuickAddModal.tsx
    DeskActionModal.tsx
    TaskDetailModal.tsx
    ThemeProvider.tsx
    MaterialCard.tsx
    TaskCard.tsx
    FeedItem/
  hooks/
    useRealtimeHive.ts
    useNotificationPermission.ts
    useMaterialCache.ts
    useTheme.ts
  lib/
    hashFile.ts          - Hash calculations for storage optimization
    fetchLinkMeta.ts     - Link crawler metadata parser
    trpc/
    supabase/
  store/
    hiveStore.ts         - Active workspace and roles states
    notificationStore.ts - Badge unread counters
    themeStore.ts        - Visual appearance preferences
  types/                 - Shared TypeScript type declarations
  sw.ts                  - Serwist offline service workers definition
supabase/
  functions/             - Supabase edge functions
    send-push-notification/
    delete-storage-object/
tests/
  e2e/                   - Playwright end-to-end integration workflows
public/
  manifest.json          - Web application manifest settings
  icons/                 - Application launcher images
```

---

## Core Features

### Desk Inbox and Quick Capture
The Desk acts as a frictionless landing zone for raw study content. Every item captured on the Desk is saved temporarily before being archived or converted.
* **Input Modes:** Supports writing plain-text notes, adding URLs, and dropping files (images, PDF, DOCX, PPTX).
* **Metadata Extraction:** Automated background scraping retrieves OpenGraph data for generic web links and oEmbed details for YouTube URLs (e.g., titles, descriptions, and thumbnail previews) within 400 milliseconds of user input.
* **Deduplication:** Client-side SHA-256 file hashing is performed prior to upload to verify if the file content already exists on the storage server, avoiding redundant storage usage.
* **Action Routing:** Items on the Desk can be shared directly to Hives, saved permanently to the Personal Library, converted into calendar tasks, or posted as Hive announcements.

### Personal Library
The Personal Library stores curated academic assets permanently.
* **Flexible Filtering:** Allows sorting materials by date added, file size, content type, or name.
* **Personal Copying:** Students can copy documents shared within a Hive into their Private Library with a single click, which increments the reference count of the file on the storage server without re-uploading bytes.
* **Offline Access:** Supports caching selected document files via service worker integration for offline viewing.

### Collaborative Study Hives
A Hive is an isolated collaborative workspace configured for a specific course or subject.
* **Role-Based Access Control (RBAC):** Users are granted roles (Owner, Admin, Member, Viewer) with distinct execution permissions:
  * Owner: Workspace deletion, settings configuration, role assignments.
  * Admin: Member moderation, announcement creation, workspace edits.
  * Member: Resource uploads, task creation and management, syllabus updates.
  * Viewer: Read-only access to syllabus checklists, shared materials, and announcements.
* **Invite System:** Admins can generate token-secured invite links with customizable role assignments, maximum usage limits, and expiration windows.

### Kanban Task Studio
* **Board Grid:** Visualizes workspace tasks under Todo, In Progress, Blocked, and Completed columns.
* **Smooth Drag and Drop:** Leverages portal-based DragOverlay rendering to bypass column overflow restrictions, ensuring cards drag smoothly without container clipping.
* **WCAG-Compliant Keyboard Reordering:** Includes dropdown menus on task cards, allowing users to reorder columns using standard keyboard inputs.
* **Material Referencing:** Users can attach documents, links, or notes to tasks using an integrated global search selection utility.

### Syllabus Progress Tree
* **Progress Tracking:** Tracks course progress via hierarchical Unit and Topic structures.
* **Syllabus Accordions:** Accordion panels display unit completion statistics and visual progress bars.
* **Topic Checkboxes:** Topics feature optimistic checkboxes, striking through text and updating progress metrics instantly.
* **Member Completion Metrics:** Administrators can view completion percentages on individual topic cards (e.g., "12 / 14 members completed").

### Timezone-Aware Calendar
* **Hourly Planners:** Features Month, Week (7-day grid, 6 AM to 10 PM), and Day views.
* **Drag-to-Reschedule:** Task blocks snap to 15-minute intervals when dragged across calendar hour slots.
* **Deadline Synchronisation:** Students can sync group milestones and Hive task deadlines directly to their personal schedule with deduplication validation.

---

## Architecture and Database Schema

### Technology Stack
* **Framework:** Next.js 16 (App Router, Turbopack)
* **Language:** TypeScript strict + @total-typescript/ts-reset
* **Styling and UI:** Tailwind CSS, shadcn/ui components, Framer Motion animations
* **Server Communication:** tRPC + Zod input validations
* **Database Access:** Drizzle ORM + PostgreSQL
* **Client State:** Zustand
* **Authentication:** Supabase Auth
* **Date Manipulation:** @internationalized/date

### Database Schema Architecture
The database consists of 22 tables managed via Drizzle ORM. Row Level Security (RLS) is enabled on all tables:
* **users:** Syncs directly with Supabase auth.users.
* **materials:** The central repository for all links, files, images, and text notes.
* **storage_objects:** Tracks content-addressed uploads keyed by SHA-256 hash signatures.
* **shelf_items:** Tracks the temporary materials active on a user's Desk.
* **library_materials:** Map of permanently archived user materials.
* **hive_material_shares:** Tracks files shared to Hives without cascading deletions from the main materials table.
* **tasks:** Represents personal and group task items.

### Content-Addressable Storage and Triggers
Files uploaded to Supabase Storage are managed by a database trigger mechanism to prevent orphaned data:
* **Upload:** A SHA-256 hash of the file is calculated. If the hash matches an existing row in `storage_objects`, the new material references the existing file path and increments the file `ref_count`.
* **Deletion:** When a user deletes a material referencing a file, a Postgres trigger decrements `ref_count`.
* **Cleanup:** When `ref_count` reaches zero, the trigger sends an HTTP POST request to a Supabase Edge Function to delete the file object from the storage bucket.

---

## Performance and Caching Strategy

### Caching Configuration (staleTime Rules)
To reduce redundant database queries and eliminate loading spinners for previously accessed views, Strizzle enforces strict Stale-While-Revalidate caching:

| Data Type | staleTime (milliseconds) | Example Views |
|---|---|---|
| Live Group Data | 30 000 | Hive overview, shared feed, calendar |
| Standard Data | 120 000 | Library list, tasks lists, members panel |
| Slow-Changing Data | 300 000 | Syllabus structures, Hive preferences |
| User Profile Data | 900 000 | Profile information, user configurations |
| Search Queries | 0 | Global search results |

### Optimistic Updates
All server mutations (such as changing a task's status on the Kanban board or completing a syllabus topic) use TanStack Query optimistic updates.
* **Mutation Execution:** Local client state is updated instantly.
* **Error Handling:** If the network request fails, the UI rolls back to the cached snapshot and displays an error toast.
* **Success Syncing:** On success, queries are invalidated to sync the client state with the server.

---

## Security Architecture

* **Database Access Control:** Row Level Security (RLS) policies restrict all queries. Users can only fetch data from workspaces where their membership is verified.
* **API Validation:** All tRPC endpoints use Zod validation schemas. Group endpoints execute role validations via an `enforceRole` helper before performing database operations.
* **Storage Protection:** The `storage_objects` table is restricted to the service role, preventing direct client access.
* **Content Security Policy (CSP):** CSP headers are configured to prevent cross-site scripting (XSS) and unauthorized code injections.

---

## Accessibility

Strizzle complies with WCAG 2.1 Level AA requirements:
* **Interactive Elements:** All icon buttons use explicit aria-labels.
* **Focus Containment:** Modals utilize focus traps, trapping focus within active modal views and returning focus to the trigger element upon closure.
* **Keyboard Support:** Supports keyboard navigation throughout calendar views, task boards, and collapsible syllabus structures.

---

## Getting Started

### Prerequisites
* Node.js (version 20 or higher)
* npm (version 10 or higher)
* A Supabase project instance (configured with PostgreSQL and Storage buckets)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/strizzle.git
   cd strizzle
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure the environment variables by creating a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   DATABASE_URL=your-postgresql-connection-string
   ```

4. Apply database migrations to your local or staging database instance:
   ```bash
   npx drizzle-kit migrate
   ```

### Running the Application
* **Development Mode:** Run the local development server with Turbopack enabled:
  ```bash
  npm run dev
  ```
* **Production Build:** Build and test the production bundle:
  ```bash
  npm run build
  npm run start
  ```
* **Testing:** Run unit and integration test suites:
  ```bash
  npm run test
  ```
  Run Playwright end-to-end integration tests:
  ```bash
  npm run test:e2e
  ```
