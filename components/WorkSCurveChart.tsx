import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { WorkDailyData, WorkPlanSchedule } from '../types';

interface Props {
  data: WorkDailyData[];
  title: string;
  target: number;
  planSchedule?: WorkPlanSchedule[]; // Plan schedule for the Plan line
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-lg rounded-lg">
        <p className="font-bold text-slate-700 mb-2">Hari {label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-slate-600">
              {entry.name}: <span className="font-semibold">{entry.value?.toLocaleString('id-ID')}</span>
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const WorkSCurveChart: React.FC<Props> = ({ data, title, target, planSchedule }) => {
  // Create chart data from planSchedule (full schedule) with actual data overlaid
  const chartData = useMemo(() => {
    // If no planSchedule, fall back to dailyData
    if (!planSchedule || planSchedule.length === 0) {
      return data.map(d => ({
        day: d.dayIndex,
        rencana: d.planCumulative || 0,
        realisasi: d.actualCumulative > 0 ? d.actualCumulative : null,
        prognosa: null,
      }));
    }

    // Build lookup maps for matching daily data to plan schedule
    // Use both dayIndex (primary, robust) and normalized date (fallback)
    const dataByDayIndex = new Map<number, typeof data[number]>();
    const dataByDate = new Map<string, typeof data[number]>();
    for (const d of data) {
      if (d.actualCumulative > 0) {
        dataByDayIndex.set(d.dayIndex, d);
        // Normalize date to YYYY-MM-DD for consistent matching
        const normalizedDate = d.date?.split('T')[0] || d.date;
        dataByDate.set(normalizedDate, d);
      }
    }

    // Find first & last actual data points
    const sortedActual = [...data]
      .filter(d => d.actualCumulative > 0)
      .sort((a, b) => a.dayIndex - b.dayIndex);

    const firstActual = sortedActual.length > 0 ? sortedActual[0] : null;
    const lastActual = sortedActual.length > 0 ? sortedActual[sortedActual.length - 1] : null;

    // Calculate average daily rate for projection (prognosa)
    const avgDailyRate = lastActual && sortedActual.length > 0
      ? lastActual.actualCumulative / sortedActual.length
      : 0;

    // Track the last known cumulative value for carry-forward
    let lastKnownCumulative = 0;


    return planSchedule.map((plan) => {
      // Match by dayIndex first, then by normalized date as fallback
      const normalizedPlanDate = plan.date?.split('T')[0] || plan.date;
      const dailyForDay = dataByDayIndex.get(plan.dayIndex) || dataByDate.get(normalizedPlanDate);
      const hasActual = !!dailyForDay;

      // Update last known cumulative when we have actual data
      if (hasActual) {
        lastKnownCumulative = dailyForDay.actualCumulative;
      }

      // Determine realisasi value:
      // - Before first actual: null (no line yet)
      // - Between first and last actual: carry forward last known cumulative
      // - After last actual: null (prognosa takes over)
      let realisasi: number | null = null;
      if (firstActual && lastActual) {
        if (plan.dayIndex >= firstActual.dayIndex && plan.dayIndex <= lastActual.dayIndex) {
          realisasi = hasActual ? dailyForDay.actualCumulative : lastKnownCumulative;
        }
      }

      // Calculate prognosa (projection)
      let prognosa: number | null = null;
      if (lastActual && plan.dayIndex > lastActual.dayIndex && avgDailyRate > 0) {
        const daysFromLastActual = plan.dayIndex - lastActual.dayIndex;
        prognosa = Math.min(target, lastActual.actualCumulative + (avgDailyRate * daysFromLastActual));
      } else if (realisasi !== null) {
        // Tie prognosa to actual line (so they overlap in the actual range)
        prognosa = realisasi;
      }

      return {
        day: plan.dayIndex,
        rencana: plan.planCumulative,
        realisasi,
        prognosa,
      };
    });
  }, [data, planSchedule, target]);

  // Find max value for Y axis - use target as baseline
  const planMax = planSchedule?.length > 0
    ? Math.max(...planSchedule.map(p => p.planCumulative))
    : 0;
  const actualMax = data.length > 0
    ? Math.max(...data.map(d => d.actualCumulative || 0))
    : 0;
  const maxValue = Math.max(target, planMax, actualMax);
  // Round up to nice number, with slight buffer (10%)
  const yAxisMax = Math.ceil(maxValue * 1.1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-6">
      <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4 text-center">{title}</h3>
      <div className="w-full h-[280px] sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              label={{ value: 'DECEMBER', position: 'bottom', fill: '#64748b', fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 10 }}
              domain={[0, yAxisMax]}
              tickFormatter={(value) => value.toLocaleString('id-ID')}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="line"
              wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
            />

            {/* Target reference line */}
            <ReferenceLine
              y={target}
              stroke="#94a3b8"
              strokeDasharray="5 5"
              label={{ value: `Target: ${target.toLocaleString('id-ID')}`, fill: '#94a3b8', fontSize: 10 }}
            />

            {/* Rencana Penanaman (Plan) - Blue */}
            <Line
              name="Rencana penanaman"
              type="monotone"
              dataKey="rencana"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />

            {/* Prognosa Penanaman (Projection) - Gray */}
            <Line
              name="Prognosa Penanaman"
              type="monotone"
              dataKey="prognosa"
              stroke="#9ca3af"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />

            {/* Realisasi Penanaman (Actual) - Orange */}
            <Line
              name="Realisasi Penanaman"
              type="monotone"
              dataKey="realisasi"
              stroke="#f97316"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6 }}
              connectNulls={true}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
