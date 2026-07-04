import { useEffect, useState } from 'react';
import type { ProjectActivityRow } from '../types';
import { fetchProjectActivities } from '../lib/supabase';

interface State {
  activities: ProjectActivityRow[];
  loading: boolean;
  error: string | null;
}

/** Lazily loads one project's activities. Pass null to reset. */
export function useProjectDetail(projectId: string | null): State {
  const [state, setState] = useState<State>({ activities: [], loading: false, error: null });

  useEffect(() => {
    if (!projectId) {
      setState({ activities: [], loading: false, error: null });
      return;
    }
    let alive = true;
    setState({ activities: [], loading: true, error: null });
    fetchProjectActivities(projectId)
      .then((activities) => { if (alive) setState({ activities, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ activities: [], loading: false, error: String(e?.message ?? e) }); });
    return () => { alive = false; };
  }, [projectId]);

  return state;
}
