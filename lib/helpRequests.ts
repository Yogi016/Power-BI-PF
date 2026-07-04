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
