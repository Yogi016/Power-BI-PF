import React, { useMemo } from 'react';
import { WeeklyData } from '../types';

interface Props {
  weeklySummary: WeeklyData[];
}

const formatPercent = (value: number) => {
  if (value === 0) return '0%';
  if (value >= 1) return `${value.toFixed(0)}%`;
  return `${value.toFixed(3)}%`;
};

export const WeeklySummaryTable: React.FC<Props> = ({ weeklySummary }) => {
  const { weeks, monthGroups, rows, latest } = useMemo(() => {
    const weeks = [...weeklySummary];

    const monthGroups: { name: string; span: number }[] = [];
    weeks.forEach((week) => {
      const month = week.week.split('-')[0];
      const label = `${month} ${week.year}`;
      const last = monthGroups[monthGroups.length - 1];
      if (last && last.name === label) {
        last.span += 1;
      } else {
        monthGroups.push({ name: label, span: 1 });
      }
    });

    // Hitung beban mingguan dari baseline/actual kumulatif
    const weeklyBaselineLoad = weeks.map((week, idx) => {
      const prev = idx === 0 ? 0 : weeks[idx - 1].baseline;
      return Math.max(week.baseline - prev, 0);
    });

    const weeklyActualLoad = weeks.map((week, idx) => {
      const prev = idx === 0 ? 0 : weeks[idx - 1].actual;
      return Math.max(week.actual - prev, 0);
    });

    const rows = [
      { label: 'Beban Tiap Minggu', values: weeklyBaselineLoad, tone: 'muted' as const },
      { label: 'Baseline S-Curve', values: weeks.map((w) => w.baseline), tone: 'accent' as const },
      { label: 'Realisasi Tiap Minggu', values: weeklyActualLoad, tone: 'muted' as const },
      { label: 'Kumulatif Realisasi', values: weeks.map((w) => w.actual), tone: 'success' as const },
    ];

    const latest = weeks[weeks.length - 1];

    return { weeks, monthGroups, rows, latest };
  }, [weeklySummary]);

  if (weeks.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Ringkasan Mingguan (Power BI Style)</h3>
          <p className="text-sm text-slate-500">Baseline, realisasi mingguan, dan kumulatif terintegrasi dari CSV.</p>
        </div>
        {latest && (
          <div className="text-right">
            <p className="text-xs uppercase text-slate-400 tracking-wide">Status Terkini</p>
            <p className="text-sm font-semibold text-slate-800">
              Baseline {latest.baseline.toFixed(1)}% · Realisasi {latest.actual.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <div className="min-w-[1100px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-600 uppercase">
                <th className="px-4 py-3 text-left font-semibold border-b border-slate-100" rowSpan={2}>
                  Metrix
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
              <tr className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
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
              {rows.map((row) => (
                <tr key={row.label} className="text-sm text-slate-700">
                  <td className="px-4 py-3 font-semibold text-slate-800 bg-slate-50 border-b border-slate-100 whitespace-nowrap">
                    {row.label}
                  </td>
                  {row.values.map((value, idx) => {
                    const isAccent = row.tone === 'accent';
                    const isSuccess = row.tone === 'success';
                    const hasValue = value > 0;
                    return (
                      <td
                        key={`${row.label}-${weeks[idx]?.week || idx}`}
                        className={`px-1 py-1 border-b border-slate-100 text-center ${
                          idx % 4 === 0 ? 'border-l border-slate-200' : ''
                        }`}
                      >
                        <div
                          className={`h-9 rounded-md flex items-center justify-center text-[11px] font-semibold ${
                            hasValue
                              ? isSuccess
                                ? 'bg-green-600 text-white'
                                : isAccent
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-slate-900 text-white'
                              : 'bg-slate-50 text-slate-300'
                          }`}
                        >
                          {hasValue ? formatPercent(value) : '-'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
