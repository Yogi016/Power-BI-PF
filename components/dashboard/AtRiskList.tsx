import React from 'react';
import type { ProjectData } from '../../types';
import { atRiskProjects, projectVariance } from '../../utils/dashboardMetrics';
import { Card, StatusBadge } from '../ui';

export const AtRiskList: React.FC<{ projects: ProjectData[] }> = ({ projects }) => {
  const risky = atRiskProjects(projects);
  return (
    <Card title="Proyek Berisiko">
      {risky.length === 0 ? (
        <p className="text-sm text-slate-500">Semua proyek sesuai atau di atas rencana.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {risky.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                <p className="truncate text-xs text-slate-500">{p.pic}</p>
              </div>
              <StatusBadge status="danger" label={`${projectVariance(p)}%`} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
