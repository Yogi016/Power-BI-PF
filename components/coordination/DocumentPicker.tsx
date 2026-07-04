import React, { useEffect, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { DocumentItem } from '../../types';
import { fetchAllDocuments } from '../../lib/supabase';

interface PickedDoc { name: string; url: string; documentId: string; }

export const DocumentPicker: React.FC<{ onClose: () => void; onPick: (doc: PickedDoc) => void }> = ({ onClose, onPick }) => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchAllDocuments()
      .then((all) => setDocs(all.filter((d) => (d.link || '').trim().length > 0)))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  const labelOf = (d: DocumentItem) => d.deskripsi || d.jenisDokumen || 'Dokumen';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      [d.deskripsi, d.jenisDokumen, d.keterangan, d.pengisi].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [docs, query]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-3">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">Pilih dari Dokumen</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Tutup"><X size={18} /></button>
        </div>
        <div className="border-b border-slate-200 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5">
            <Search size={15} className="text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari dokumen…" aria-label="Cari dokumen" className="w-full py-2 text-sm focus:outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <p className="p-3 text-sm text-slate-500">Memuat dokumen…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">Tidak ada dokumen ber-softfile.</p>
          ) : (
            filtered.map((d) => (
              <button
                key={d.id}
                onClick={() => onPick({ name: labelOf(d), url: d.link as string, documentId: d.id })}
                className="mb-1 w-full rounded-lg border border-slate-200 p-2.5 text-left transition hover:border-slate-300"
              >
                <span className="block truncate text-sm font-medium text-slate-900">{labelOf(d)}</span>
                {(d.jenisDokumen || d.tanggal) && (
                  <span className="block truncate text-xs text-slate-500">{[d.jenisDokumen, d.tanggal].filter(Boolean).join(' · ')}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
