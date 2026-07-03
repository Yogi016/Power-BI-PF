# Coordination Hub — Help Requests with Threaded Replies (Proyek B)

Date: 2026-07-03
Status: Approved (design), pending implementation plan
Depends on: nothing in Proyek A; ships independently after it.

## Goal

A lightweight in-app coordination channel so anyone can send a **directed help
request** to anyone else, discuss it in a **thread**, and track its **status**
(Terbuka → Diproses → Selesai). Surfaced through a floating bubble with an
**unread badge**, coexisting with the existing Danta.AI bubble.

## Confirmed decisions

- **Directed only, any → any**: any authenticated user can send to any other user.
  No broadcast/announcements. No formal approve/reject (dropped) — status
  tracking only.
- **Threaded replies** per request.
- **Status**: `open` (Terbuka) → `in_progress` (Diproses) → `done` (Selesai).
- **Unread badge + poll**: unread computed on panel open and after sending. No
  Supabase Realtime.

## Data model (new migration)

`supabase/migrations/<timestamp>_create_help_requests.sql`

- `help_requests`
  - `id uuid pk default uuid_generate_v4()`
  - `from_user uuid not null references auth.users(id)`
  - `to_user uuid not null references auth.users(id)`
  - `subject text not null`
  - `body text not null`
  - `status text not null default 'open' check (status in ('open','in_progress','done'))`
  - `created_at timestamptz default now()`, `updated_at timestamptz default now()`
  - indexes on `to_user`, `from_user`, `updated_at`
- `help_request_messages`
  - `id uuid pk`, `request_id uuid not null references help_requests(id) on delete cascade`
  - `sender_user uuid not null references auth.users(id)`
  - `body text not null`, `created_at timestamptz default now()`
  - index on `(request_id, created_at)`
- `help_request_reads` (unread tracking)
  - `request_id uuid references help_requests(id) on delete cascade`
  - `user_id uuid references auth.users(id)`
  - `last_read_at timestamptz default now()`
  - primary key `(request_id, user_id)`
- `update_updated_at_column` trigger on `help_requests` (reuse existing function
  from `schema.sql`).

### RLS (participant-based — routing is any→any, so no role checks)

Enable RLS on all three tables.
- `help_requests`
  - SELECT: `auth.uid() = from_user OR auth.uid() = to_user`
  - INSERT: `auth.uid() = from_user`
  - UPDATE (status): `auth.uid() = from_user OR auth.uid() = to_user`
- `help_request_messages`
  - SELECT: participant of the parent request (subquery on `help_requests`)
  - INSERT: `sender_user = auth.uid()` AND sender is a participant
- `help_request_reads`
  - ALL: `user_id = auth.uid()`

Migration is authored here but applied by the user to the confirmed Supabase
project ref only (AGENTS.md: local `.env.local` ref has differed from the MCP
ref — do not apply blindly).

## Data layer — `lib/supabase.ts`

- `fetchMyHelpRequests(): Promise<HelpRequestSummary[]>` — requests where I'm a
  participant, joined with latest message time + my `last_read_at`, so each row
  carries `unread: boolean` and `role: 'incoming' | 'outgoing'`. Ordered by
  `updated_at` desc.
- `createHelpRequest(toUser, subject, body): Promise<boolean>`
- `fetchHelpRequestThread(requestId): Promise<HelpRequestMessage[]>`
- `postHelpRequestMessage(requestId, body): Promise<boolean>` — also bumps parent
  `updated_at`.
- `updateHelpRequestStatus(requestId, status): Promise<boolean>`
- `markHelpRequestRead(requestId): Promise<void>` — upsert `help_request_reads`
  with `last_read_at = now()`.
- `fetchRecipients(): Promise<RecipientOption[]>` — from `user_profiles`
  (`user_id`, `full_name`, `role_code`), excluding self, for the recipient picker.

New types in `types.ts`: `HelpRequestStatus`, `HelpRequestSummary`,
`HelpRequestMessage`, `RecipientOption`.

## Hook — `hooks/useHelpRequests.ts`

- Module-level cache (30s TTL + in-flight dedup), same pattern as
  `useCooperationDocuments`.
- Exposes `{ requests, unreadCount, loading, error }` and
  `invalidateHelpRequestsCache()`.
- `unreadCount` = number of requests with `unread === true`.

## UI — `components/coordination/`

### `CoordinationBubble.tsx`
- Floating button, fixed bottom-right, **offset to the left of the Danta.AI
  bubble** so they don't overlap (Danta.AI stays rightmost). Action Blue,
  message icon, unread count badge.
- Toggles `CoordinationPanel`. Refreshes unread on open and after sends.
- Mounted in `App.tsx` alongside `<AIChatbot />`, only when a user is signed in.

### `CoordinationPanel.tsx`
- Right slide-over. `SegmentedTabs`: **Masuk** (incoming) / **Terkirim**
  (outgoing). Each row: subject, counterpart name, `StatusBadge`, unread dot,
  relative time. "+ Permintaan baru" opens the compose form.
- Compose: recipient picker (`fetchRecipients`), subject, body → `createHelpRequest`
  → invalidate cache.
- Selecting a row opens `RequestThread`; on open calls `markHelpRequestRead`.

### `RequestThread.tsx`
- Header: subject, counterpart, status control (a `SegmentedTabs` or select for
  Terbuka/Diproses/Selesai) — editable by either participant via
  `updateHelpRequestStatus`.
- Message list (`fetchHelpRequestThread`) with sender/self alignment and time.
- Reply box → `postHelpRequestMessage` → refetch thread + invalidate list.

All copy in Bahasa Indonesia; reuse `Card`, `Button`, `StatusBadge`,
`SegmentedTabs`; follow DESIGN.md (Action Blue only interactive color, status
colors paired with icons, `rounded-xl`/`rounded-lg`, `shadow-sm`).

## Unread logic

For a request, `unread = latestMessageFromCounterpart.created_at > my last_read_at`
(or no `reads` row yet and a message exists from the counterpart). Computed
server-side in `fetchMyHelpRequests` join; badge = count of such requests.
Refreshed on panel open and after posting.

## Testing

- Add `scripts/test-help-requests.ts` (pure logic where possible): unread
  computation from `(messages, last_read_at, currentUser)`, and status transition
  validation (`open`→`in_progress`→`done`).
- RLS: verify a non-participant cannot select a request (manual/SQL check on the
  confirmed project).
- `./node_modules/.bin/vite build` green.

## Risks / notes

- Two floating bubbles must not overlap on mobile — define explicit offsets and
  test the mobile viewport.
- No realtime: a recipient sees a new request only after reopening the panel
  (poll). Acceptable per decision; can add Realtime later without schema change.
- `fetchRecipients` exposes the user directory (names + roles) to all signed-in
  users — acceptable for an internal team tool.
```
