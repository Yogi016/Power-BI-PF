import { useEffect, useState } from 'react';
import type { HelpRequestSummary } from '../types';
import { fetchMyHelpRequests } from '../lib/supabase';

interface State {
  requests: HelpRequestSummary[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

let cached: HelpRequestSummary[] | null = null;
let cacheTimestamp = 0;
let inflight: Promise<HelpRequestSummary[]> | null = null;
const CACHE_TTL_MS = 30_000;

function getCachedOrFetch(): Promise<HelpRequestSummary[]> {
  const now = Date.now();
  if (cached !== null && now - cacheTimestamp < CACHE_TTL_MS) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetchMyHelpRequests()
    .then((rows) => { cached = rows; cacheTimestamp = Date.now(); inflight = null; return rows; })
    .catch((err) => { inflight = null; throw err; });
  return inflight;
}

export function useHelpRequests(): State {
  const [state, setState] = useState<State>(() => {
    if (cached !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      return { requests: cached, unreadCount: cached.filter((r) => r.unread).length, loading: false, error: null };
    }
    return { requests: [], unreadCount: 0, loading: true, error: null };
  });

  useEffect(() => {
    if (!state.loading) return;
    let alive = true;
    getCachedOrFetch()
      .then((rows) => { if (alive) setState({ requests: rows, unreadCount: rows.filter((r) => r.unread).length, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ requests: [], unreadCount: 0, loading: false, error: String(e?.message ?? e) }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

/** Call after any mutation so the next mount re-fetches. */
export function invalidateHelpRequestsCache(): void {
  cached = null;
  cacheTimestamp = 0;
  inflight = null;
}
