import { useEffect, useState } from 'react';
import type { CooperationDocument } from '../types';
import { fetchCooperationDocuments } from '../lib/supabase';

interface State {
  documents: CooperationDocument[];
  loading: boolean;
  error: string | null;
}

// ── Module-level cache ──────────────────────────────────────────────
// Prevents duplicate Supabase fetches when multiple components
// (e.g. VpDashboard + ActionInbox) call this hook simultaneously.
let cachedDocs: CooperationDocument[] | null = null;
let cacheTimestamp = 0;
let inflightPromise: Promise<CooperationDocument[]> | null = null;

const CACHE_TTL_MS = 30_000; // 30 seconds

function getCachedOrFetch(): Promise<CooperationDocument[]> {
  const now = Date.now();

  // Return cached data if still fresh
  if (cachedDocs !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return Promise.resolve(cachedDocs);
  }

  // Deduplicate concurrent requests — reuse the in-flight promise
  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = fetchCooperationDocuments()
    .then((docs) => {
      cachedDocs = docs;
      cacheTimestamp = Date.now();
      inflightPromise = null;
      return docs;
    })
    .catch((err) => {
      inflightPromise = null;
      throw err;
    });

  return inflightPromise;
}

export function useCooperationDocuments(): State {
  const [state, setState] = useState<State>(() => {
    // If cache is warm, initialise synchronously to avoid flicker
    if (cachedDocs !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      return { documents: cachedDocs, loading: false, error: null };
    }
    return { documents: [], loading: true, error: null };
  });

  useEffect(() => {
    // Already satisfied from cache in initialiser
    if (!state.loading) return;

    let alive = true;
    getCachedOrFetch()
      .then((docs) => { if (alive) setState({ documents: docs, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ documents: [], loading: false, error: String(e?.message ?? e) }); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

/** Call this after a mutation to force the next mount to re-fetch. */
export function invalidateCooperationDocumentsCache(): void {
  cachedDocs = null;
  cacheTimestamp = 0;
  inflightPromise = null;
}
