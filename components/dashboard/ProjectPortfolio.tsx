import React, { useMemo, useState } from 'react';
import type { ProjectData } from '../../types';
import { latestPlanned, latestProgress, projectVariance, projectHealth } from '../../utils/dashboardMetrics';
import { Card, StatusBadge } from '../ui';
import { HEALTH_BADGE } from './projectHealth';
import { ProjectDetailDrawer } from './ProjectDetailDrawer';

export const ProjectPortfolio: React.FC<{ projects: ProjectData[] }> = ({ projects }) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.pic || '').toLowerCase().includes(q),
    );
  }, [projects, query]);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <Card
      title="Portfolio Proyek"
      action={
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari proyek atau PIC…"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
        />
      }
    >
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada proyek untuk ditampilkan.</p>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-tight text-slate-500">
                <th className="px-3 py-2">Proyek</th>
                <th className="px-3 py-2">PIC</th>
                <th className="px-3 py-2 text-right">Rencana</th>
                <th className="px-3 py-2 text-right">Aktual</th>
                <th className="px-3 py-2 text-right">Varians</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const v = projectVariance(p);
                const badge = HEALTH_BADGE[projectHealth(p)];
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(p.id);
                      }
                    }}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="px-3 py-2 text-slate-600">{p.pic}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{latestPlanned(p)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{latestProgress(p)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{v > 0 ? '+' : ''}{v}%</td>
                    <td className="px-3 py-2"><StatusBadge status={badge.status} label={badge.label} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <ProjectDetailDrawer project={selected} onClose={() => setSelectedId(null)} />}
    </Card>
  );
};
