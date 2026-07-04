import type { HelpRequestStatus, HelpRequestAttachment } from '../types';

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

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/;

/** True when the name/url points at a common image type (ignores query string). */
export function isImageAttachment(nameOrUrl: string): boolean {
  return IMAGE_EXT.test(nameOrUrl.split('?')[0].toLowerCase());
}

/** Splits attachments into initial-request (messageId null) and per-message groups. */
export function groupAttachmentsByMessage(attachments: HelpRequestAttachment[]): {
  requestLevel: HelpRequestAttachment[];
  byMessage: Map<string, HelpRequestAttachment[]>;
} {
  const requestLevel: HelpRequestAttachment[] = [];
  const byMessage = new Map<string, HelpRequestAttachment[]>();
  for (const a of attachments) {
    if (a.messageId === null) {
      requestLevel.push(a);
    } else {
      const arr = byMessage.get(a.messageId) ?? [];
      arr.push(a);
      byMessage.set(a.messageId, arr);
    }
  }
  return { requestLevel, byMessage };
}
