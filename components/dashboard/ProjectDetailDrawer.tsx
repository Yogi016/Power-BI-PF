import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ProjectData } from '../../types';
import { latestPlanned, latestProgress, projectVariance, projectHealth, portfolioSeries } from '../../utils/dashboardMetrics';
import { useProjectDetail } from '../../hooks/useProjectDetail';
import { SCurveChart } from '../SCurveChart';
import { StatusBadge } from '../ui';
import { HEALTH_BADGE, ACTIVITY_BADGE } from './projectHealth';

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold tracking-tight text-slate-500">{label}</p>
    <p className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
  </div>
);

export const ProjectDetailDrawer: React.FC<{ project: ProjectData; onClose: () => void }> = ({ project, onClose }) => {
  const { activities, loading, error } = useProjectDetail(project.id);
  const health = HEALTH_BADGE[projectHealth(project)];
  const series = portfolioSeries([project]);
  const variance = projectVariance(project);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl custom-scrollbar">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{project.name}</h2>
            <p className="text-sm text-slate-500">PIC: {project.pic}</p>
            <div className="mt-2"><StatusBadge status={health.status} label={health.label} /></div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#0071e3]"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Rencana" value={`${latestPlanned(project)}%`} />
            <Stat label="Aktual" value={`${latestProgress(project)}%`} />
            <Stat label="Varians" value={`${variance > 0 ? '+' : ''}${variance}%`} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold tracking-tight text-slate-900">Kurva-S</h3>
            {series.length > 0 ? (
              <SCurveChart data={series} showWeekly={false} compact />
            ) : (
              <p className="text-sm text-slate-500">Belum ada data progres.</p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold tracking-tight text-slate-900">Aktivitas</h3>
            {loading ? (
              <p className="text-sm text-slate-500">Memuat aktivitas…</p>
            ) : error ? (
              <p className="text-sm text-red-600">Gagal memuat aktivitas.</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada aktivitas.</p>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-tight text-slate-500">
                      <th className="px-3 py-2">Aktivitas</th>
                      <th className="px-3 py-2">PIC</th>
                      <th className="px-3 py-2 text-right">Bobot</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((a) => {
                      const badge = ACTIVITY_BADGE[a.status];
                      return (
                        <tr key={a.id} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {a.code ? `${a.code}. ` : ''}{a.activityName}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{a.pic || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">{a.weight}%</td>
                          <td className="px-3 py-2"><StatusBadge status={badge.status} label={badge.label} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
