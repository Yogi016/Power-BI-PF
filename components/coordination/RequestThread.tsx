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
