import React from 'react';
import type { ProjectData } from '../../types';
import { latestProgress, latestPlanned, projectVariance } from '../../utils/dashboardMetrics';
import { Card, StatusBadge } from '../ui';
import type { Status } from '../ui';

const health = (variance: number): { status: Status; label: string } =>
  variance >= 0 ? { status: 'positive', label: 'On-track' }
  : variance < -10 ? { status: 'danger', label: 'Berisiko' }
  : { status: 'warning', label: 'Tertinggal' };

export const ProjectTable: React.FC<{ projects: ProjectData[] }> = ({ projects }) => (
  <Card title="Daftar Proyek">
    {projects.length === 0 ? (
      <p className="text-sm text-slate-500">Belum ada proyek untuk ditampilkan.</p>
    ) : (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-tight text-slate-500">
            <th className="px-3 py-2">Proyek</th>
            <th className="px-3 py-2">PIC</th>
            <th className="px-3 py-2 text-right">Rencana</th>
            <th className="px-3 py-2 text-right">Aktual</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const v = projectVariance(p);
            const h = health(v);
            return (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                <td className="px-3 py-2 text-slate-600">{p.pic}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{latestPlanned(p)}%</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{latestProgress(p)}%</td>
                <td className="px-3 py-2"><StatusBadge status={h.status} label={h.label} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    )}
  </Card>
);
