import { useEffect, useState } from 'react';
import type { CooperationDocument } from '../types';
import { fetchCooperationDocuments } from '../lib/supabase';

interface State {
  documents: CooperationDocument[];
  loading: boolean;
  error: string | null;
}

export function useCooperationDocuments(): State {
  const [state, setState] = useState<State>({ documents: [], loading: true, error: null });

  useEffect(() => {
    let alive = true;
    fetchCooperationDocuments()
      .then((docs) => { if (alive) setState({ documents: docs, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ documents: [], loading: false, error: String(e?.message ?? e) }); });
    return () => { alive = false; };
  }, []);

  return state;
}
