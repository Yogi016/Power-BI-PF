# Coordination Hub Implementation Plan (Proyek B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A floating "Koordinasi" bubble letting any signed-in user send a directed help request to any other user, discuss it in a thread, and track status (Terbuka → Diproses → Selesai), with an unread badge.

**Architecture:** Three Supabase tables (`help_requests`, `help_request_messages`, `help_request_reads`) with participant-based RLS. Pure helpers (`lib/helpRequests.ts`) compute unread state and validate status (unit-tested). Data functions in `lib/supabase.ts`. A cached `useHelpRequests` hook (mirrors `useCooperationDocuments`). UI in `components/coordination/` (bubble + panel + thread), mounted in `App.tsx` beside `<AIChatbot />`.

**Tech Stack:** React 18 + TypeScript, Vite, Supabase JS, Tailwind v4, existing `components/ui` primitives (`Card`, `Button`, `StatusBadge`, `SegmentedTabs`). Tests are `tsx` scripts run with `npx tsx`.

**Verification commands:**
- Logic tests: `npx tsx scripts/test-help-requests.ts` → prints `help-requests OK`
- Build: `./node_modules/.bin/vite build` (exit 0). Do NOT run `npm run build`.
- Migration is authored only; the user applies it to the confirmed Supabase project ref (per AGENTS.md — local `.env.local` ref has differed from the MCP ref).

---

## File Structure

- Create `supabase/migrations/20260703010000_create_help_requests.sql` — tables + RLS + trigger.
- Modify `types.ts` — help-request types.
- Create `lib/helpRequests.ts` — pure `hasUnread` + `isHelpRequestStatus` helpers.
- Create `scripts/test-help-requests.ts` — tests for the pure helpers.
- Modify `lib/supabase.ts` — data functions.
- Create `hooks/useHelpRequests.ts` — cached hook + unread count + invalidate.
- Create `components/coordination/CoordinationBubble.tsx` — floating button + badge + panel host.
- Create `components/coordination/CoordinationPanel.tsx` — inbox tabs + compose.
- Create `components/coordination/RequestThread.tsx` — thread + reply + status control.
- Modify `App.tsx` — mount `<CoordinationBubble />` for signed-in users.

---

## Task 1: Database migration (authored; user applies)

**Files:**
- Create: `supabase/migrations/20260703010000_create_help_requests.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =====================================================
-- Coordination Hub: directed help requests + threaded replies
-- =====================================================

CREATE TABLE IF NOT EXISTS help_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject VARCHAR(300) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_help_requests_to ON help_requests(to_user);
CREATE INDEX IF NOT EXISTS idx_help_requests_from ON help_requests(from_user);
CREATE INDEX IF NOT EXISTS idx_help_requests_updated ON help_requests(updated_at DESC);

CREATE TABLE IF NOT EXISTS help_request_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
    sender_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_messages_request ON help_request_messages(request_id, created_at);

CREATE TABLE IF NOT EXISTS help_request_reads (
    request_id UUID NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (request_id, user_id)
);

-- updated_at trigger (function already defined in schema.sql)
CREATE TRIGGER update_help_requests_updated_at
    BEFORE UPDATE ON help_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS (participant-based; routing is any -> any)
-- =====================================================
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_request_reads ENABLE ROW LEVEL SECURITY;

-- help_requests
CREATE POLICY hr_select ON help_requests FOR SELECT TO authenticated
    USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY hr_insert ON help_requests FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = from_user);
CREATE POLICY hr_update ON help_requests FOR UPDATE TO authenticated
    USING (auth.uid() = from_user OR auth.uid() = to_user)
    WITH CHECK (auth.uid() = from_user OR auth.uid() = to_user);

-- help_request_messages (participant of the parent request)
CREATE POLICY hrm_select ON help_request_messages FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM help_requests r
        WHERE r.id = help_request_messages.request_id
          AND (auth.uid() = r.from_user OR auth.uid() = r.to_user)
    ));
CREATE POLICY hrm_insert ON help_request_messages FOR INSERT TO authenticated
    WITH CHECK (
        sender_user = auth.uid()
        AND EXISTS (
            SELECT 1 FROM help_requests r
            WHERE r.id = help_request_messages.request_id
              AND (auth.uid() = r.from_user OR auth.uid() = r.to_user)
        )
    );

-- help_request_reads (each user manages own rows)
CREATE POLICY hrr_all ON help_request_reads FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Verify the SQL parses locally (syntax sanity only)**

Run: `grep -c "CREATE POLICY" supabase/migrations/20260703010000_create_help_requests.sql`
Expected: `6`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260703010000_create_help_requests.sql
git commit -m "feat: add help_requests schema and RLS migration"
```

> NOTE: Do NOT apply this migration automatically. The user applies it to the confirmed Supabase project ref (Supabase dashboard SQL editor or `supabase db push` against the right project).

---

## Task 2: Types

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Append the help-request types**

```typescript
export type HelpRequestStatus = 'open' | 'in_progress' | 'done';

export interface HelpRequestSummary {
  id: string;
  fromUser: string;
  toUser: string;
  subject: string;
  status: HelpRequestStatus;
  createdAt: string;
  updatedAt: string;
  direction: 'incoming' | 'outgoing';
  counterpartName: string;
  unread: boolean;
}

export interface HelpRequestMessage {
  id: string;
  requestId: string;
  senderUser: string;
  body: string;
  createdAt: string;
}

export interface RecipientOption {
  userId: string;
  fullName: string;
  roleCode: string;
}
```

- [ ] **Step 2: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add help-request types"
```

---

## Task 3: Pure helpers (TDD)

**Files:**
- Create: `lib/helpRequests.ts`
- Test: `scripts/test-help-requests.ts`

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-help-requests.ts`:

```typescript
import assert from 'node:assert';
import { hasUnread, isHelpRequestStatus } from '../lib/helpRequests';

const ME = 'me';
const OTHER = 'other';

// No counterpart activity → not unread (I created it, no replies)
assert.strictEqual(
  hasUnread('2026-01-01T00:00:00Z', ME, [], null, ME),
  false,
);

// Incoming request I never read → unread (the request itself is counterpart activity)
assert.strictEqual(
  hasUnread('2026-01-01T00:00:00Z', OTHER, [], null, ME),
  true,
);

// Incoming request read after creation, no newer messages → not unread
assert.strictEqual(
  hasUnread('2026-01-01T00:00:00Z', OTHER, [], '2026-01-02T00:00:00Z', ME),
  false,
);

// Counterpart replied after my last read → unread
assert.strictEqual(
  hasUnread(
    '2026-01-01T00:00:00Z', OTHER,
    [{ senderUser: OTHER, createdAt: '2026-01-03T00:00:00Z' }],
    '2026-01-02T00:00:00Z', ME,
  ),
  true,
);

// Only my own messages after last read → not unread
assert.strictEqual(
  hasUnread(
    '2026-01-01T00:00:00Z', ME,
    [{ senderUser: ME, createdAt: '2026-01-03T00:00:00Z' }],
    '2026-01-02T00:00:00Z', ME,
  ),
  false,
);

// Status validity
assert.strictEqual(isHelpRequestStatus('open'), true);
assert.strictEqual(isHelpRequestStatus('in_progress'), true);
assert.strictEqual(isHelpRequestStatus('done'), true);
assert.strictEqual(isHelpRequestStatus('archived'), false);

console.log('help-requests OK');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx scripts/test-help-requests.ts`
Expected: FAIL — cannot find module `../lib/helpRequests`.

- [ ] **Step 3: Implement the helpers**

Create `lib/helpRequests.ts`:

```typescript
import type { HelpRequestStatus } from '../types';

const STATUSES: HelpRequestStatus[] = ['open', 'in_progress', 'done'];

export function isHelpRequestStatus(s: string): s is HelpRequestStatus {
  return (STATUSES as string[]).includes(s);
}

/**
 * Decides whether a request has unread activity for the viewer. Activity from
 * the counterpart = the request creation itself (if the viewer did not create
 * it) plus any message not authored by the viewer. Unread when the latest such
 * timestamp is newer than the viewer's last_read_at (or never read).
 */
export function hasUnread(
  createdAt: string,
  fromUser: string,
  messages: { senderUser: string; createdAt: string }[],
  lastReadAt: string | null,
  viewerId: string,
): boolean {
  const counterpartTimes: string[] = [];
  if (fromUser !== viewerId) counterpartTimes.push(createdAt);
  for (const m of messages) {
    if (m.senderUser !== viewerId) counterpartTimes.push(m.createdAt);
  }
  if (counterpartTimes.length === 0) return false;
  const latest = counterpartTimes.reduce((a, b) => (a > b ? a : b));
  if (!lastReadAt) return true;
  return latest > lastReadAt;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx scripts/test-help-requests.ts`
Expected: PASS — prints `help-requests OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/helpRequests.ts scripts/test-help-requests.ts
git commit -m "feat: add help-request unread + status helpers with tests"
```

---

## Task 4: Data layer

**Files:**
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Add the type imports**

In the `import { ... } from '../types';` block near the top of `lib/supabase.ts`, add:
```
  HelpRequestStatus,
  HelpRequestSummary,
  HelpRequestMessage,
  RecipientOption,
```

Add this import right after that block:
```typescript
import { hasUnread } from './helpRequests';
```

- [ ] **Step 2: Add the data functions**

Append at the end of `lib/supabase.ts`:

```typescript
// =====================================================
// COORDINATION HUB (help requests)
// =====================================================

/** Requests where the current user is a participant, with unread + counterpart name. */
export async function fetchMyHelpRequests(): Promise<HelpRequestSummary[]> {
  if (!supabase) return [];
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return [];

    const { data: reqData, error: reqError } = await supabase
      .from('help_requests')
      .select('id, from_user, to_user, subject, status, created_at, updated_at')
      .or(`from_user.eq.${uid},to_user.eq.${uid}`)
      .order('updated_at', { ascending: false })
      .abortSignal(AbortSignal.timeout(5_000));
    if (reqError) throw reqError;

    const requests = reqData || [];
    if (requests.length === 0) return [];

    const ids = requests.map((r: any) => r.id);
    const counterpartIds = Array.from(
      new Set(requests.map((r: any) => (r.from_user === uid ? r.to_user : r.from_user))),
    );

    const [msgRes, readRes, profileRes] = await Promise.all([
      supabase.from('help_request_messages').select('request_id, sender_user, created_at').in('request_id', ids),
      supabase.from('help_request_reads').select('request_id, last_read_at').eq('user_id', uid).in('request_id', ids),
      supabase.from('user_profiles').select('user_id, full_name').in('user_id', counterpartIds),
    ]);
    if (msgRes.error) throw msgRes.error;
    if (readRes.error) throw readRes.error;
    if (profileRes.error) throw profileRes.error;

    const messagesByReq = new Map<string, { senderUser: string; createdAt: string }[]>();
    (msgRes.data || []).forEach((m: any) => {
      const arr = messagesByReq.get(m.request_id) ?? [];
      arr.push({ senderUser: m.sender_user, createdAt: m.created_at });
      messagesByReq.set(m.request_id, arr);
    });
    const readByReq = new Map<string, string>();
    (readRes.data || []).forEach((r: any) => readByReq.set(r.request_id, r.last_read_at));
    const nameById = new Map<string, string>();
    (profileRes.data || []).forEach((p: any) => nameById.set(p.user_id, p.full_name));

    return requests.map((r: any): HelpRequestSummary => {
      const counterpartId = r.from_user === uid ? r.to_user : r.from_user;
      return {
        id: r.id,
        fromUser: r.from_user,
        toUser: r.to_user,
        subject: r.subject,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        direction: r.to_user === uid ? 'incoming' : 'outgoing',
        counterpartName: nameById.get(counterpartId) || 'Pengguna',
        unread: hasUnread(r.created_at, r.from_user, messagesByReq.get(r.id) ?? [], readByReq.get(r.id) ?? null, uid),
      };
    });
  } catch (error) {
    console.error('Error fetching help requests:', error);
    return [];
  }
}

export async function createHelpRequest(toUser: string, subject: string, body: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return false;
    const { error } = await supabase
      .from('help_requests')
      .insert({ from_user: uid, to_user: toUser, subject, body });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating help request:', error);
    return false;
  }
}

export async function fetchHelpRequestThread(requestId: string): Promise<HelpRequestMessage[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('help_request_messages')
      .select('id, request_id, sender_user, body, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
      .abortSignal(AbortSignal.timeout(5_000));
    if (error) throw error;
    return (data || []).map((m: any) => ({
      id: m.id,
      requestId: m.request_id,
      senderUser: m.sender_user,
      body: m.body,
      createdAt: m.created_at,
    }));
  } catch (error) {
    console.error('Error fetching help request thread:', error);
    throw error;
  }
}

export async function postHelpRequestMessage(requestId: string, body: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return false;
    const { error } = await supabase
      .from('help_request_messages')
      .insert({ request_id: requestId, sender_user: uid, body });
    if (error) throw error;
    // Bump parent so it re-sorts to the top of both participants' lists.
    await supabase.from('help_requests').update({ updated_at: new Date().toISOString() }).eq('id', requestId);
    return true;
  } catch (error) {
    console.error('Error posting help request message:', error);
    return false;
  }
}

export async function updateHelpRequestStatus(requestId: string, status: HelpRequestStatus): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('help_requests').update({ status }).eq('id', requestId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating help request status:', error);
    return false;
  }
}

export async function markHelpRequestRead(requestId: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;
    await supabase
      .from('help_request_reads')
      .upsert({ request_id: requestId, user_id: uid, last_read_at: new Date().toISOString() });
  } catch (error) {
    console.error('Error marking help request read:', error);
  }
}

/** All other users, for the recipient picker. */
export async function fetchRecipients(): Promise<RecipientOption[]> {
  if (!supabase) return [];
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, role_code')
      .order('full_name', { ascending: true })
      .abortSignal(AbortSignal.timeout(5_000));
    if (error) throw error;
    return (data || [])
      .filter((p: any) => p.user_id !== uid)
      .map((p: any) => ({ userId: p.user_id, fullName: p.full_name || 'Pengguna', roleCode: p.role_code }));
  } catch (error) {
    console.error('Error fetching recipients:', error);
    return [];
  }
}
```

- [ ] **Step 3: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "supabase.ts|helpRequests"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add help-request data layer functions"
```

---

## Task 5: useHelpRequests hook

**Files:**
- Create: `hooks/useHelpRequests.ts`

- [ ] **Step 1: Create the hook (mirrors useCooperationDocuments)**

```tsx
import { useEffect, useState } from 'react';
import type { HelpRequestSummary } from '../types';
import { fetchMyHelpRequests } from '../lib/supabase';

interface State {
  requests: HelpRequestSummary[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

let cached: HelpRequestSummary[] | null = null;
let cacheTimestamp = 0;
let inflight: Promise<HelpRequestSummary[]> | null = null;
const CACHE_TTL_MS = 30_000;

function getCachedOrFetch(): Promise<HelpRequestSummary[]> {
  const now = Date.now();
  if (cached !== null && now - cacheTimestamp < CACHE_TTL_MS) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetchMyHelpRequests()
    .then((rows) => { cached = rows; cacheTimestamp = Date.now(); inflight = null; return rows; })
    .catch((err) => { inflight = null; throw err; });
  return inflight;
}

export function useHelpRequests(): State {
  const [state, setState] = useState<State>(() => {
    if (cached !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      return { requests: cached, unreadCount: cached.filter((r) => r.unread).length, loading: false, error: null };
    }
    return { requests: [], unreadCount: 0, loading: true, error: null };
  });

  useEffect(() => {
    if (!state.loading) return;
    let alive = true;
    getCachedOrFetch()
      .then((rows) => { if (alive) setState({ requests: rows, unreadCount: rows.filter((r) => r.unread).length, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ requests: [], unreadCount: 0, loading: false, error: String(e?.message ?? e) }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

/** Call after any mutation so the next mount re-fetches. */
export function invalidateHelpRequestsCache(): void {
  cached = null;
  cacheTimestamp = 0;
  inflight = null;
}
```

- [ ] **Step 2: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add hooks/useHelpRequests.ts
git commit -m "feat: add useHelpRequests cache hook"
```

---

## Task 6: RequestThread component

**Files:**
- Create: `components/coordination/RequestThread.tsx`

- [ ] **Step 1: Create the thread view**

```tsx
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import type { HelpRequestMessage, HelpRequestStatus, HelpRequestSummary } from '../../types';
import {
  fetchHelpRequestThread,
  postHelpRequestMessage,
  updateHelpRequestStatus,
} from '../../lib/supabase';
import { SegmentedTabs, Button } from '../ui';

const STATUS_TABS = [
  { id: 'open', label: 'Terbuka' },
  { id: 'in_progress', label: 'Diproses' },
  { id: 'done', label: 'Selesai' },
];

interface Props {
  request: HelpRequestSummary;
  currentUserId: string;
  onBack: () => void;
  onChanged: () => void; // invalidate list cache after any mutation
}

export const RequestThread: React.FC<Props> = ({ request, currentUserId, onBack, onChanged }) => {
  const [messages, setMessages] = useState<HelpRequestMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState<HelpRequestStatus>(request.status);
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true);
    fetchHelpRequestThread(request.id)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, [request.id]);

  const send = async () => {
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await postHelpRequestMessage(request.id, body);
    setSending(false);
    if (ok) {
      setReply('');
      onChanged();
      load();
    }
  };

  const changeStatus = async (next: string) => {
    const prev = status;
    setStatus(next as HelpRequestStatus);
    const ok = await updateHelpRequestStatus(request.id, next as HelpRequestStatus);
    if (ok) onChanged();
    else setStatus(prev);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <button
          onClick={onBack}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={16} /> Kembali
        </button>
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{request.subject}</h3>
        <p className="text-xs text-slate-500">{request.counterpartName}</p>
        <div className="mt-3"><SegmentedTabs tabs={STATUS_TABS} value={status} onChange={changeStatus} /></div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <p className="text-sm text-slate-500">Memuat percakapan…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada balasan. Mulai percakapan di bawah.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderUser === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? 'bg-blue-50 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>
                  {m.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 p-3">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Tulis balasan…"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
        />
        <Button onClick={send} disabled={sending || !reply.trim()}><Send size={16} /></Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0. (`Button` extends `ButtonHTMLAttributes`, so `onClick`, `disabled`, and children are all supported.)

- [ ] **Step 3: Commit**

```bash
git add components/coordination/RequestThread.tsx
git commit -m "feat: add RequestThread conversation view"
```

---

## Task 7: CoordinationPanel component

**Files:**
- Create: `components/coordination/CoordinationPanel.tsx`

- [ ] **Step 1: Create the panel (inbox tabs + compose + thread routing)**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { HelpRequestSummary, RecipientOption } from '../../types';
import { createHelpRequest, fetchRecipients, markHelpRequestRead } from '../../lib/supabase';
import { useHelpRequests, invalidateHelpRequestsCache } from '../../hooks/useHelpRequests';
import { SegmentedTabs, Button, StatusBadge } from '../ui';
import type { Status } from '../ui';
import { RequestThread } from './RequestThread';

const STATUS_BADGE: Record<string, { status: Status; label: string }> = {
  open: { status: 'warning', label: 'Terbuka' },
  in_progress: { status: 'neutral', label: 'Diproses' },
  done: { status: 'positive', label: 'Selesai' },
};

interface Props {
  currentUserId: string;
  onClose: () => void;
  onMutated: () => void; // let the bubble refresh its unread badge
}

type View = { kind: 'list' } | { kind: 'compose' } | { kind: 'thread'; request: HelpRequestSummary };

export const CoordinationPanel: React.FC<Props> = ({ currentUserId, onClose, onMutated }) => {
  const { requests, loading } = useHelpRequests();
  const [tab, setTab] = useState('incoming');
  const [view, setView] = useState<View>({ kind: 'list' });

  const filtered = useMemo(
    () => requests.filter((r) => r.direction === tab),
    [requests, tab],
  );

  const refresh = () => { invalidateHelpRequestsCache(); onMutated(); };

  const openThread = (r: HelpRequestSummary) => {
    setView({ kind: 'thread', request: r });
    if (r.unread) markHelpRequestRead(r.id).then(refresh);
  };

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:right-auto sm:w-96">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">Koordinasi</h2>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Tutup"><X size={18} /></button>
      </div>

      {view.kind === 'thread' ? (
        <RequestThread
          request={view.request}
          currentUserId={currentUserId}
          onBack={() => setView({ kind: 'list' })}
          onChanged={refresh}
        />
      ) : view.kind === 'compose' ? (
        <ComposeForm
          onCancel={() => setView({ kind: 'list' })}
          onSent={() => { refresh(); setView({ kind: 'list' }); }}
        />
      ) : (
        <>
          <div className="flex items-center justify-between p-3">
            <SegmentedTabs
              tabs={[{ id: 'incoming', label: 'Masuk' }, { id: 'outgoing', label: 'Terkirim' }]}
              value={tab}
              onChange={setTab}
            />
            <Button onClick={() => setView({ kind: 'compose' })}><Plus size={16} /></Button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
            {loading ? (
              <p className="p-3 text-sm text-slate-500">Memuat…</p>
            ) : filtered.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">Tidak ada permintaan.</p>
            ) : (
              filtered.map((r) => {
                const badge = STATUS_BADGE[r.status];
                return (
                  <button
                    key={r.id}
                    onClick={() => openThread(r)}
                    className="mb-2 w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{r.subject}</span>
                      {r.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#0066cc]" aria-label="Belum dibaca" />}
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="truncate text-xs text-slate-500">{r.counterpartName}</span>
                      <StatusBadge status={badge.status} label={badge.label} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ComposeForm: React.FC<{ onCancel: () => void; onSent: () => void }> = ({ onCancel, onSent }) => {
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [toUser, setToUser] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { fetchRecipients().then(setRecipients).catch(() => setRecipients([])); }, []);

  const submit = async () => {
    if (!toUser || !subject.trim() || !body.trim() || sending) return;
    setSending(true);
    const ok = await createHelpRequest(toUser, subject.trim(), body.trim());
    setSending(false);
    if (ok) onSent();
  };

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Kirim ke</label>
        <select
          value={toUser}
          onChange={(e) => setToUser(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
        >
          <option value="">Pilih penerima…</option>
          {recipients.map((r) => <option key={r.userId} value={r.userId}>{r.fullName} ({r.roleCode})</option>)}
        </select>
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subjek"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Tulis permintaan bantuan…"
        rows={5}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Batal</Button>
        <Button onClick={submit} disabled={sending || !toUser || !subject.trim() || !body.trim()}>Kirim</Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0. (`Button` supports `variant='secondary'`, `disabled`, `onClick`, and children — verified against `components/ui/Button.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add components/coordination/CoordinationPanel.tsx
git commit -m "feat: add CoordinationPanel inbox and compose"
```

---

## Task 8: CoordinationBubble + mount

**Files:**
- Create: `components/coordination/CoordinationBubble.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Create the bubble**

```tsx
import React, { useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHelpRequests, invalidateHelpRequestsCache } from '../../hooks/useHelpRequests';
import { CoordinationPanel } from './CoordinationPanel';

// Bottom-LEFT so it never overlaps the Danta.AI bubble (bottom-right).
export const CoordinationBubble: React.FC = () => {
  const { user } = useAuth();
  const { unreadCount } = useHelpRequests();
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user) return null;

  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <>
      {open && (
        <CoordinationPanel
          key={refreshKey}
          currentUserId={user.id}
          onClose={() => setOpen(false)}
          onMutated={bump}
        />
      )}
      <button
        onClick={() => { if (!open) invalidateHelpRequestsCache(); setOpen((o) => !o); }}
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0066cc] text-white shadow-lg transition hover:bg-[#0055b3] active:scale-[0.98]"
        aria-label="Pusat Koordinasi"
      >
        <MessagesSquare size={22} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>
    </>
  );
};
```

Note: `key={refreshKey}` forces `CoordinationPanel`/`useHelpRequests` to remount after a mutation, and toggling open calls `invalidateHelpRequestsCache()` so the badge and list poll fresh data on open.

- [ ] **Step 2: Mount in `App.tsx`**

Add a lazy import next to the existing `AIChatbot` lazy import (after `App.tsx:9`):
```tsx
const CoordinationBubble = lazy(() => import('./components/coordination/CoordinationBubble').then((module) => ({ default: module.CoordinationBubble })));
```

Then, inside `AuthenticatedApp`, change the existing chatbot mount:
```tsx
      <Suspense fallback={null}>
        <AIChatbot />
      </Suspense>
```
to:
```tsx
      <Suspense fallback={null}>
        <AIChatbot />
      </Suspense>
      <Suspense fallback={null}>
        <CoordinationBubble />
      </Suspense>
```

- [ ] **Step 3: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "coordination|CoordinationBubble|CoordinationPanel|RequestThread|App.tsx"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/coordination/CoordinationBubble.tsx App.tsx
git commit -m "feat: add CoordinationBubble and mount it in App"
```

---

## Task 9: Final verification

- [ ] **Step 1: Logic tests**

Run: `npx tsx scripts/test-help-requests.ts`
Expected: `help-requests OK`.

- [ ] **Step 2: Build + typecheck of touched files**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "helpRequests|useHelpRequests|coordination|Coordination|RequestThread"`
Expected: no output.

- [ ] **Step 3: Confirm the migration is not applied automatically**

The migration file exists under `supabase/migrations/` but must be applied by the user to the confirmed Supabase project. Note in the final report that manual application is required before the feature works end-to-end.

- [ ] **Step 4: Manual smoke test (after migration applied)**

Sign in as two different users. As user A, open the Koordinasi bubble (bottom-left) → "+" → pick user B, send a request. As user B, confirm the unread badge appears, open the request, reply, and change status to "Diproses". Back as user A, confirm the reply is visible and the badge reflects the unread reply.
```
