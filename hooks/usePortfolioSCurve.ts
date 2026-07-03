import { useEffect, useState } from 'react';
import type { PortfolioSeriesPoint } from '../types';
import { fetchPortfolioSCurve } from '../lib/supabase';

interface State {
  data: PortfolioSeriesPoint[];
  loading: boolean;
  error: string | null;
}

// ── Module-level cache ──────────────────────────────────────────────
// Multiple role dashboards mount SCurvePanel; this shares one fetch per
// project-scope key instead of each panel hitting Supabase independently.
interface Entry {
  data: PortfolioSeriesPoint[];
  timestamp: number;
  inflight: Promise<PortfolioSeriesPoint[]> | null;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const cache = new Map<string, Entry>();

function keyFor(projectIds?: string[]): string {
  if (!projectIds || projectIds.length === 0) return 'ALL';
  return [...projectIds].sort().join(',');
}

function isFresh(entry: Entry | undefined): entry is Entry {
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

function getCachedOrFetch(projectIds?: string[]): Promise<PortfolioSeriesPoint[]> {
  const key = keyFor(projectIds);
  const entry = cache.get(key);

  if (isFresh(entry) && !entry.inflight) {
    return Promise.resolve(entry.data);
  }
  if (entry?.inflight) {
    return entry.inflight;
  }

  const inflight = fetchPortfolioSCurve('monthly', projectIds)
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now(), inflight: null });
      return data;
    })
    .catch((err) => {
      const current = cache.get(key);
      if (current) current.inflight = null;
      throw err;
    });

  cache.set(key, {
    data: entry?.data ?? [],
    timestamp: entry?.timestamp ?? 0,
    inflight,
  });
  return inflight;
}

export function usePortfolioSCurve(projectIds?: string[]): State {
  const key = keyFor(projectIds);
  const [state, setState] = useState<State>(() => {
    const entry = cache.get(key);
    if (isFresh(entry)) {
      return { data: entry.data, loading: false, error: null };
    }
    return { data: [], loading: true, error: null };
  });

  useEffect(() => {
    let alive = true;
    const entry = cache.get(key);

    if (isFresh(entry) && !entry.inflight) {
      setState({ data: entry.data, loading: false, error: null });
      return;
    }

    setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
    getCachedOrFetch(projectIds)
      .then((data) => { if (alive) setState({ data, loading: false, error: null }); })
      .catch((e) => {
        if (alive) setState({ data: [], loading: false, error: String(e?.message ?? e) });
      });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

/** Call after saving S-Curve data so the next mount re-fetches. */
export function invalidatePortfolioSCurveCache(): void {
  cache.clear();
}
