import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { MonthlyData, WeeklyData } from '../types';
import { COLORS } from '../constants';

interface Props {
  data?: MonthlyData[];
  weeklyData?: WeeklyData[];
  showWeekly?: boolean;
  yearLabel?: string | null;
  compact?: boolean;
}

const CHART_MAX_PERCENT = 100;

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(CHART_MAX_PERCENT, value));
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const visiblePayload = payload.filter((entry: any) => entry.name !== 'actual');

    return (
      <div className="bg-white p-4 border border-slate-200 shadow-lg rounded-lg">
        <p className="font-bold text-slate-700 mb-2">{label}</p>
        {visiblePayload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-slate-600">
              {entry.name}: <span className="font-semibold">{entry.value}%</span>
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const getCompactLegendLabel = (value: unknown) => {
  const label = String(value || '');
  if (label.includes('Baseline')) return 'Baseline';
  if (label.includes('Realisasi')) return 'Realisasi';
  if (label.includes('Target')) return 'Target';
  return label;
};

const CustomLegend = ({ payload, compact }: any) => {
  const visiblePayload = payload?.filter((entry: any) => entry.value !== 'actual') || [];

  if (!visiblePayload.length) return null;

  return (
    <div className={`flex flex-nowrap items-center justify-center gap-x-3 overflow-hidden ${compact ? 'pb-1 text-[10px]' : 'pb-2 text-sm'}`}>
      {visiblePayload.map((entry: any) => (
        <div key={`${entry.dataKey}-${entry.value}`} className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-semibold" style={{ color: entry.color }}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="truncate">{compact ? getCompactLegendLabel(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const SCurveChart: React.FC<Props> = ({ data, weeklyData, showWeekly = false, yearLabel, compact = false }) => {
  // Convert weekly data to chart format
  const chartData = showWeekly && weeklyData 
    ? weeklyData.map((w, idx) => {
        const clampedBaseline = clampPercent(w.baseline);
        const prev = idx === 0 ? 0 : clampPercent(weeklyData[idx - 1].baseline);
        const weeklyTarget = Math.max(0, clampedBaseline - prev);
        return {
          period: `${w.week} (${w.year})`,
          plan: clampedBaseline,
          actual: clampPercent(w.actual),
          weeklyTarget,
        };
      })
    : data?.map(d => ({
        period: `${d.month}${yearLabel ? ` (${yearLabel})` : ''}`,
        plan: clampPercent(d.plan),
        actual: clampPercent(d.actual),
      })) || [];

  // Untuk weekly data, kita perlu mengurangi jumlah tick yang ditampilkan
  const xAxisConfig = showWeekly 
    ? {
        dataKey: "period",
        angle: -45,
        textAnchor: "end",
        height: 100,
        interval: 3, // Tampilkan setiap 4 minggu
        tick: { fill: COLORS.chartAxis, fontSize: 10 },
      }
    : {
        dataKey: "period",
        tick: { fill: COLORS.chartAxis, fontSize: compact ? 10 : 12 },
      };

  return (
    <div className={compact ? 'w-full h-[280px]' : 'w-full h-[300px] sm:h-[400px]'}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={compact
            ? { top: 8, right: 8, left: -10, bottom: showWeekly ? 70 : 2 }
            : { top: 20, right: 30, left: 0, bottom: showWeekly ? 80 : 0 }}
        >
          <defs>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.chartActual} stopOpacity={0.1}/>
              <stop offset="95%" stopColor={COLORS.chartActual} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.chartGrid} />
          <XAxis 
            {...xAxisConfig}
            axisLine={false}
            tickLine={false}
            dy={showWeekly ? 60 : 10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.chartAxis, fontSize: compact ? 10 : 12 }}
            domain={[0, CHART_MAX_PERCENT]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={compact ? 24 : 36}
            iconType="circle"
            content={(props) => <CustomLegend {...props} compact={compact} />}
          />
          
          {/* Baseline Curve */}
          <Line
            name="Baseline (Plan)"
            type="monotone"
            dataKey="plan"
            stroke={COLORS.chartPlan}
            strokeDasharray="6 4"
            strokeWidth={3}
            dot={{ r: showWeekly ? 2 : 4, strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 6 }}
          />

          {/* Weekly target (delta baseline) */}
          {showWeekly && (
            <Bar
              name="Target Mingguan"
              dataKey="weeklyTarget"
              barSize={12}
              fill="#c084fc"
              opacity={0.8}
              radius={[4, 4, 4, 4]}
            />
          )}

          {/* Actual Curve */}
          <Area
            type="monotone"
            dataKey="actual"
            fill="url(#colorActual)"
            stroke="none"
            legendType="none"
          />
          <Line
            name="Realisasi (Actual)"
            type="monotone"
            dataKey="actual"
            stroke={COLORS.chartActual}
            strokeWidth={3}
            dot={{ r: showWeekly ? 2 : 4, strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
