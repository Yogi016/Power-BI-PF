import React from 'react';
import { SCurveChart } from '../SCurveChart';
import { usePortfolioSCurve } from '../../hooks/usePortfolioSCurve';
import { Card } from '../ui';

interface SCurvePanelProps {
  /** Optional project scope. Empty/undefined aggregates the whole portfolio. */
  projectIds?: string[];
  title?: string;
}

// Budget-weighted portfolio S-curve sourced from s_curve_baseline/s_curve_actual
// (the same tables Manage Data writes to), aggregated in fetchPortfolioSCurve.
export const SCurvePanel: React.FC<SCurvePanelProps> = ({ projectIds, title = 'Kurva-S' }) => {
  const { data, loading } = usePortfolioSCurve(projectIds);
  return (
    <Card title={title}>
      {loading ? (
        <p className="text-sm text-slate-500">Memuat data progres…</p>
      ) : data.length > 0 ? (
        <SCurveChart data={data} showWeekly={false} compact />
      ) : (
        <p className="text-sm text-slate-500">Belum ada data progres untuk ditampilkan.</p>
      )}
    </Card>
  );
};
