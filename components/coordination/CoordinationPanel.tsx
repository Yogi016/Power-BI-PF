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
    <div className="fixed inset-x-3 bottom-[5.35rem] z-[70] flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:inset-auto sm:bottom-24 sm:right-6 sm:w-96">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">Chat JS</h2>
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
        <label htmlFor="hr-recipient" className="mb-1 block text-xs font-semibold text-slate-500">Kirim ke</label>
        <select
          id="hr-recipient"
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
        aria-label="Subjek permintaan"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Tulis permintaan bantuan…"
        aria-label="Isi permintaan bantuan"
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
