import React from 'react';
import type { ProjectData } from '../../types';
import { SCurveChart } from '../SCurveChart';
import { portfolioSeries } from '../../utils/dashboardMetrics';
import { Card } from '../ui';

interface SCurvePanelProps {
  projects: ProjectData[];
  title?: string;
}

// Aggregates all provided projects into one averaged S-curve.
export const SCurvePanel: React.FC<SCurvePanelProps> = ({ projects, title = 'Kurva-S' }) => {
  const data = portfolioSeries(projects);
  return (
    <Card title={title}>
      {data.length > 0 ? (
        <SCurveChart data={data} showWeekly={false} compact />
      ) : (
        <p className="text-sm text-slate-500">Belum ada data progres untuk ditampilkan.</p>
      )}
    </Card>
  );
};
