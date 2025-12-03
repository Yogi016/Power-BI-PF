import React, { Fragment, useMemo } from 'react';
import { ProjectData, WeeklyData } from '../types';

interface Props {
  weeks: WeeklyData[];
  projects: ProjectData[];
}

const formatPercent = (value: number) => {
  if (value === 0) return '';
  if (value >= 1) return `${value.toFixed(1)}%`;
  return `${value.toFixed(3)}%`;
};

export const WeeklyTimeline: React.FC<Props> = ({ weeks, projects }) => {
  const monthGroups = useMemo(() => {
    const groups: { name: string; span: number }[] = [];
    weeks.forEach((week) => {
      const month = week.week.split('-')[0];
      const label = `${month} ${week.year}`;
      const last = groups[groups.length - 1];
      if (last && last.name === label) {
        last.span += 1;
      } else {
        groups.push({ name: label, span: 1 });
      }
    });
    return groups;
  }, [weeks]);

  if (weeks.length === 0 || projects.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Timeline Aktivitas (Gaya Power BI)</h3>
          <p className="text-sm text-slate-500">
            Menampilkan progres mingguan tiap aktivitas pada grid minggu per bulan.
          </p>
        </div>
        <div className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
          {projects.length} proyek · {weeks.length} minggu
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <div className="min-w-[1200px]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 uppercase">
                <th rowSpan={2} className="px-4 py-3 text-left font-semibold border-b border-slate-100 w-24">
                  PIC
                </th>
                <th rowSpan={2} className="px-4 py-3 text-left font-semibold border-b border-slate-100 w-64">
                  Proyek
                </th>
                <th rowSpan={2} className="px-4 py-3 text-left font-semibold border-b border-slate-100 w-72">
                  Aktivitas
                </th>
                {monthGroups.map((group, idx) => (
                  <th
                    key={`${group.name}-${idx}`}
                    className="px-3 py-2 text-center font-semibold border-b border-slate-100"
                    colSpan={group.span}
                  >
                    {group.name}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                {weeks.map((week, idx) => {
                  const [, weekNumber] = week.week.split('-');
                  return (
                    <th
                      key={week.week}
                      className={`px-2 py-2 font-semibold border-b border-slate-100 ${
                        idx % 4 === 0 ? 'border-l border-slate-200' : ''
                      }`}
                    >
                      {weekNumber}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <Fragment key={project.id}>
                  {project.activities.map((activity, idx) => {
                    const rowSpan = project.activities.length;
                    return (
                      <tr key={`${project.id}-${idx}`} className="border-t border-slate-100 hover:bg-slate-50">
                        {idx === 0 && (
                          <td
                            rowSpan={rowSpan}
                            className="px-4 py-3 align-top text-slate-800 font-semibold border-r border-slate-100"
                          >
                            <span className="px-2 py-1 bg-slate-900 text-white rounded text-[11px] tracking-wide">
                              {project.pic}
                            </span>
                          </td>
                        )}
                        {idx === 0 && (
                          <td
                            rowSpan={rowSpan}
                            className="px-4 py-3 align-top text-slate-700 font-semibold border-r border-slate-100"
                          >
                            {project.name}
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-800">
                          <div className="font-semibold">{activity.activity}</div>
                          <div className="text-[11px] text-slate-500">
                            {[activity.category, activity.subCategory].filter(Boolean).join(' • ')}
                          </div>
                        </td>
                        {weeks.map((week, weekIdx) => {
                          const value = activity.weeklyProgress[week.week] || 0;
                          const active = value > 0;
                          return (
                            <td
                              key={`${activity.activity}-${week.week}`}
                              className={`px-1 py-1 text-center border-l border-slate-100 ${
                                weekIdx % 4 === 0 ? 'border-slate-200' : ''
                              }`}
                            >
                              <div
                                className={`h-8 rounded-md flex items-center justify-center font-semibold ${
                                  active ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-300'
                                }`}
                              >
                                {active ? formatPercent(value) : ''}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
