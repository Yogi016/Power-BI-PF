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
