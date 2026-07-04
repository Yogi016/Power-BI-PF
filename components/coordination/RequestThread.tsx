import React, { useEffect, useState } from 'react';
import { ArrowLeft, Send, ExternalLink } from 'lucide-react';
import type { AttachmentDraft, HelpRequestAttachment, HelpRequestMessage, HelpRequestStatus, HelpRequestSummary } from '../../types';
import {
  addHelpRequestAttachments,
  fetchHelpRequestAttachments,
  fetchHelpRequestThread,
  postHelpRequestMessage,
  updateHelpRequestStatus,
} from '../../lib/supabase';
import { groupAttachmentsByMessage, isImageAttachment } from '../../lib/helpRequests';
import { resolveAttachments } from './attachmentUpload';
import { AttachmentPicker } from './AttachmentPicker';
import { SegmentedTabs, Button } from '../ui';

const STATUS_TABS = [
  { id: 'open', label: 'Terbuka' },
  { id: 'in_progress', label: 'Diproses' },
  { id: 'done', label: 'Selesai' },
];

const AttachmentList: React.FC<{ items: HelpRequestAttachment[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {items.map((a) =>
        isImageAttachment(a.name) || isImageAttachment(a.url) ? (
          <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" title={a.name}>
            <img src={a.url} alt={a.name} loading="lazy" className="max-h-40 rounded-lg border border-slate-200 object-cover" />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[12rem] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-[#0066cc] hover:border-slate-300"
          >
            <ExternalLink size={12} /> <span className="truncate">{a.name}</span>
          </a>
        ),
      )}
    </div>
  );
};

interface Props {
  request: HelpRequestSummary;
  currentUserId: string;
  onBack: () => void;
  onChanged: () => void;
}

export const RequestThread: React.FC<Props> = ({ request, currentUserId, onBack, onChanged }) => {
  const [messages, setMessages] = useState<HelpRequestMessage[]>([]);
  const [attachments, setAttachments] = useState<HelpRequestAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  const [status, setStatus] = useState<HelpRequestStatus>(request.status);
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchHelpRequestThread(request.id).catch(() => []),
      fetchHelpRequestAttachments(request.id).catch(() => []),
    ])
      .then(([msgs, atts]) => { setMessages(msgs); setAttachments(atts); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [request.id]);

  const grouped = groupAttachmentsByMessage(attachments);

  const send = async () => {
    const body = reply.trim();
    if ((!body && drafts.length === 0) || sending) return;
    setSending(true);
    const messageId = await postHelpRequestMessage(request.id, body || '(lampiran)');
    if (messageId) {
      const resolved = await resolveAttachments(drafts);
      if (resolved.length) await addHelpRequestAttachments(request.id, messageId, resolved);
      setReply('');
      setDrafts([]);
      onChanged();
      load();
    }
    setSending(false);
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
        <button onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Kembali
        </button>
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{request.subject}</h3>
        <p className="text-xs text-slate-500">{request.counterpartName}</p>
        <AttachmentList items={grouped.requestLevel} />
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
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? 'bg-blue-50 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>
                  {m.body}
                </div>
                <AttachmentList items={grouped.byMessage.get(m.id) ?? []} />
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <AttachmentPicker drafts={drafts} onChange={setDrafts} />
        <div className="mt-2 flex items-center gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Tulis balasan…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
          />
          <Button onClick={send} disabled={sending || (!reply.trim() && drafts.length === 0)}><Send size={16} /></Button>
        </div>
      </div>
    </div>
  );
};
