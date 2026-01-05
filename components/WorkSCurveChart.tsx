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
    
    // Sort data by dayIndex to ensure correct processing
    const sortedData = [...data].sort((a, b) => a.dayIndex - b.dayIndex);
    const actualData = sortedData.filter(item => item.actualCumulative > 0);
    const lastActual = actualData.length > 0 ? actualData[actualData.length - 1] : null;

    // Calculate average daily rate strictly for projection
    const avgDailyRate = lastActual ? lastActual.actualCumulative / actualData.length : 0;
    
    // Track cumulative value to fill gaps
    let currentCumulative = 0;
    
    return planSchedule.map((plan) => {
      // Find actual data for this day
      const dailyForDay = sortedData.find(d => d.date === plan.date);
      const hasActual = dailyForDay && dailyForDay.actualCumulative > 0;
      
      // Update current cumulative if we have actual data
      if (hasActual) {
        currentCumulative = dailyForDay!.actualCumulative;
      }
      
      // Determine if we should show realization for this day
      // Show if:
      // 1. We have actual data for this day OR
      // 2. We have a previous cumulative value AND this day is before or same as the last recorded actual day
      const shouldShowRealisasi = hasActual || (currentCumulative > 0 && lastActual && plan.dayIndex <= lastActual.dayIndex);
      
      // Calculate prognosa (projection)
      let prognosa = null;
      if (lastActual && plan.dayIndex > lastActual.dayIndex && avgDailyRate > 0) {
        const daysFromLastActual = plan.dayIndex - lastActual.dayIndex;
        prognosa = Math.min(target, lastActual.actualCumulative + (avgDailyRate * daysFromLastActual));
      } else if (shouldShowRealisasi) {
        // Tie prognosa to actual line
        prognosa = hasActual ? dailyForDay!.actualCumulative : currentCumulative;
      }
      
      return {
        day: plan.dayIndex,
        rencana: plan.planCumulative,
        realisasi: shouldShowRealisasi ? (hasActual ? dailyForDay!.actualCumulative : currentCumulative) : null,
        prognosa: prognosa,
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">{title}</h3>
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="day"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'DECEMBER', position: 'bottom', fill: '#64748b', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              domain={[0, yAxisMax]}
              tickFormatter={(value) => value.toLocaleString('id-ID')}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              iconType="line"
              wrapperStyle={{ paddingTop: '20px' }}
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
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
