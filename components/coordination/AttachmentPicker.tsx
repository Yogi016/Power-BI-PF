import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, FileText, X } from 'lucide-react';
import type { AttachmentDraft } from '../../types';
import { isImageAttachment } from '../../lib/helpRequests';
import { DocumentPicker } from './DocumentPicker';

let draftCounter = 0;
const nextKey = () => `d${draftCounter++}`;

export const AttachmentPicker: React.FC<{ drafts: AttachmentDraft[]; onChange: (next: AttachmentDraft[]) => void }> = ({ drafts, onChange }) => {
  const [pickingDoc, setPickingDoc] = useState(false);
  const prevRef = useRef<AttachmentDraft[]>([]);

  // Revoke object URLs for drafts that disappeared (removed here, or cleared by
  // the parent after send), and everything still staged on unmount.
  useEffect(() => {
    const keys = new Set(drafts.map((d) => d.key));
    prevRef.current.forEach((d) => { if (!keys.has(d.key) && d.previewUrl) URL.revokeObjectURL(d.previewUrl); });
    prevRef.current = drafts;
  }, [drafts]);
  useEffect(() => () => { prevRef.current.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl)); }, []);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const added: AttachmentDraft[] = Array.from(files).map((file) => ({
      key: nextKey(),
      name: file.name,
      source: 'upload',
      file,
      previewUrl: isImageAttachment(file.name) ? URL.createObjectURL(file) : undefined,
    }));
    onChange([...drafts, ...added]);
  };

  // Revocation is handled by the diff effect above.
  const remove = (key: string) => onChange(drafts.filter((d) => d.key !== key));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300">
          <Paperclip size={14} /> Upload file
          <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        <button type="button" onClick={() => setPickingDoc(true)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300">
          <FileText size={14} /> Dari Dokumen
        </button>
      </div>

      {drafts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {drafts.map((d) => {
            const preview = d.previewUrl ?? (d.source === 'document' && isImageAttachment(d.name) ? d.url : undefined);
            return (
              <span key={d.key} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-1.5 pr-1 text-xs text-slate-700">
                {preview ? (
                  <img src={preview} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <FileText size={14} className="text-slate-400" />
                )}
                <span className="max-w-[10rem] truncate">{d.name}</span>
                <button type="button" onClick={() => remove(d.key)} className="rounded p-0.5 text-slate-400 hover:bg-slate-200" aria-label="Hapus lampiran"><X size={12} /></button>
              </span>
            );
          })}
        </div>
      )}

      {pickingDoc && (
        <DocumentPicker
          onClose={() => setPickingDoc(false)}
          onPick={(doc) => {
            onChange([...drafts, { key: nextKey(), name: doc.name, source: 'document', url: doc.url, documentId: doc.documentId }]);
            setPickingDoc(false);
          }}
        />
      )}
    </div>
  );
};
