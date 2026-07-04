import type { AttachmentDraft, AttachmentSource } from '../../types';
import { uploadCoordinationFile } from '../../lib/supabase';

export interface ResolvedAttachment {
  name: string;
  url: string;
  source: AttachmentSource;
  documentId?: string | null;
}

/** Uploads pending files and maps document drafts to persistable rows. Skips failed uploads. */
export async function resolveAttachments(drafts: AttachmentDraft[]): Promise<ResolvedAttachment[]> {
  const out: ResolvedAttachment[] = [];
  for (const d of drafts) {
    if (d.source === 'document' && d.url) {
      out.push({ name: d.name, url: d.url, source: 'document', documentId: d.documentId ?? null });
    } else if (d.source === 'upload' && d.file) {
      try {
        const up = await uploadCoordinationFile(d.file);
        if (up) out.push({ name: d.name, url: up.url, source: 'upload' });
      } catch {
        // skip failed upload; the rest still send
      }
    }
  }
  return out;
}
