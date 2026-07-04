# Chat JS Attachments — Design

Date: 2026-07-04
Status: Approved (design), pending implementation plan
Builds on: the Coordination Hub / "Chat JS" feature (help_requests + help_request_messages).

## Goal

Let users optionally attach one or more files to a Chat JS help request — both
when composing a new request and when replying in a thread. A file can come from
two sources: (1) a fresh upload, or (2) an existing record in the Dokumen archive
(searchable picker). Attachments render in the thread and open on click.

## Confirmed decisions

- Attachments allowed on **both** compose (initial request) and thread replies.
- **Multiple** attachments per message → a dedicated attachments table.
- Two sources: **upload** (new file → R2) and **document** (reference an existing
  Dokumen record's file URL). Optional — a message can have zero attachments.

## Storage model (approach A)

One table `help_request_attachments` with a `request_id` (always set, for RLS +
initial-request attachments) and an optional `message_id`:
- `message_id IS NULL` → attached to the initial request (shown at the top of the thread).
- `message_id` set → attached to that specific reply.

### Migration `supabase/migrations/20260704010000_create_help_request_attachments.sql`

```sql
CREATE TABLE IF NOT EXISTS help_request_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
    message_id UUID REFERENCES help_request_messages(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'document')),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_attachments_request ON help_request_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_hr_attachments_message ON help_request_attachments(message_id);
```

RLS (participant of the parent request; same pattern as help_request_messages):
- SELECT / INSERT gated on an `EXISTS` subquery against `help_requests` for
  `request_id` where the caller is `from_user` or `to_user`.
- INSERT additionally requires `uploaded_by = auth.uid()`.

Migration is authored only; the user applies it to the confirmed Supabase project
ref `qafozqmwlfenxorshgfl` (see [[supabase-project-refs]]).

## Storage helper — `lib/supabase.ts`

`uploadCoordinationFile(file: File): Promise<{ url: string; storageKey: string } | null>`
mirrors `uploadAssetFile` but writes under a `coordination/<timestamp>_<name>` key
via the existing R2 Worker. Reuse the existing asset size/type limits
(`MAX_ASSET_SIZE_MB`, allowed types) — no new validation constants.

## Data layer changes — `lib/supabase.ts`

- `createHelpRequest(toUser, subject, body)` — change return type from `boolean`
  to `Promise<string | null>` (the new request id, or null on failure) so
  attachments can be linked.
- `postHelpRequestMessage(requestId, body)` — change return type from `boolean`
  to `Promise<string | null>` (the new message id). Still bumps parent `updated_at`.
- New `addHelpRequestAttachments(requestId, messageId, items)` where
  `items: { name; url; source; documentId? }[]` → bulk insert.
- New `fetchHelpRequestAttachments(requestId): Promise<HelpRequestAttachment[]>`.
- Reuse existing `fetchAllDocuments()` for the Dokumen picker; only documents
  whose `link` is non-empty are attachable (that URL becomes the attachment url).

Callers updated: `ComposeForm` and `RequestThread` now branch on `id !== null`
instead of a boolean.

## Types — `types.ts`

```ts
export type AttachmentSource = 'upload' | 'document';

export interface HelpRequestAttachment {
  id: string;
  requestId: string;
  messageId: string | null;
  name: string;
  url: string;
  source: AttachmentSource;
  documentId: string | null;
  createdAt: string;
}

// Staged (pre-send) attachment in the composer/reply box.
export interface AttachmentDraft {
  key: string;              // local id for list keys/removal
  name: string;
  source: AttachmentSource;
  file?: File;              // present when source === 'upload' (not yet uploaded)
  url?: string;             // present when source === 'document'
  documentId?: string;      // present when source === 'document'
}
```

## Pure helper + test — `lib/helpRequests.ts` / `scripts/test-help-requests.ts`

`groupAttachmentsByMessage(attachments): { requestLevel: HelpRequestAttachment[]; byMessage: Map<string, HelpRequestAttachment[]> }`
splits attachments into initial-request (messageId null) and per-message groups.
Add unit tests for this grouping alongside the existing `hasUnread` tests.

## UI — `components/coordination/`

### `AttachmentPicker.tsx` (new, shared)
- Props: `{ drafts: AttachmentDraft[]; onChange: (next) => void }`.
- Two controls: **Upload file** (`<input type="file" multiple>`) and **Dari
  Dokumen** (opens `DocumentPicker`). Adds to `drafts`.
- Renders staged drafts as chips (name + remove ×).

### `DocumentPicker.tsx` (new)
- Modal listing `fetchAllDocuments()` filtered to those with a non-empty `link`,
  with a search box (filter by deskripsi/jenisDokumen/keterangan, client-side).
- Selecting a document adds an `AttachmentDraft` with
  `{ source: 'document', name: deskripsi || jenisDokumen || 'Dokumen', url: link, documentId }`.

### `ComposeForm` (in `CoordinationPanel.tsx`)
- Add `<AttachmentPicker>`. On submit:
  1. `createHelpRequest` → `requestId`. If null, abort.
  2. For each `upload` draft: `uploadCoordinationFile(file)` → url (skip failed).
  3. `addHelpRequestAttachments(requestId, null, resolvedItems)`.

### `RequestThread`
- Reply bar gets an attach control (paperclip) using `AttachmentPicker`; a small
  staged-chip row above the input.
- On send: `postHelpRequestMessage` → `messageId`; upload staged uploads;
  `addHelpRequestAttachments(requestId, messageId, resolvedItems)`; refetch.
- Fetch attachments (`fetchHelpRequestAttachments`) alongside the thread; render
  request-level attachments under the header, and each message's attachments
  under its bubble as clickable links (open in new tab, `rel="noopener"`).

All copy Bahasa Indonesia; reuse `Button`, `Card`, DESIGN.md tokens (Action Blue,
`rounded-lg` chips). Upload failures show a notification but don't block sending
the message/request.

## Out of scope (YAGNI)

- Deleting/renaming attachments after send.
- Image thumbnails / inline previews (links only).
- Drag-and-drop upload.

## Verification

- `npx tsx scripts/test-help-requests.ts` (grouping + existing) → `help-requests OK`.
- `./node_modules/.bin/vite build` exit 0.
- Manual (after migration applied): attach an uploaded file and a Dokumen file on
  a new request; reply with an attachment; confirm both participants see and can
  open them.
```
