import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
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
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-lg rounded-lg">
        <p className="font-bold text-slate-700 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
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

export const SCurveChart: React.FC<Props> = ({ data, weeklyData, showWeekly = false }) => {
  // Convert weekly data to chart format
  const chartData = showWeekly && weeklyData 
    ? weeklyData.map(w => ({
        period: w.week,
        plan: w.baseline,
        actual: w.actual,
      }))
    : data?.map(d => ({
        period: d.month,
        plan: d.plan,
        actual: d.actual,
      })) || [];

  // Untuk weekly data, kita perlu mengurangi jumlah tick yang ditampilkan
  const xAxisConfig = showWeekly 
    ? {
        dataKey: "period",
        angle: -45,
        textAnchor: "end",
        height: 100,
        interval: 3, // Tampilkan setiap 4 minggu
        tick: { fill: '#64748b', fontSize: 10 },
      }
    : {
        dataKey: "period",
        tick: { fill: '#64748b', fontSize: 12 },
      };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: showWeekly ? 80 : 0 }}
        >
          <defs>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.actualLine} stopOpacity={0.1}/>
              <stop offset="95%" stopColor={COLORS.actualLine} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            {...xAxisConfig}
            axisLine={false}
            tickLine={false}
            dy={showWeekly ? 60 : 10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            domain={[0, 120]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={36}
            iconType="circle"
          />
          
          {/* Baseline Curve */}
          <Line
            name="Baseline (Plan)"
            type="monotone"
            dataKey="plan"
            stroke={COLORS.planLine}
            strokeWidth={3}
            dot={{ r: showWeekly ? 2 : 4, strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 6 }}
          />

          {/* Actual Curve */}
          <Area
            type="monotone"
            dataKey="actual"
            fill="url(#colorActual)"
            stroke="none"
          />
          <Line
            name="Realisasi (Actual)"
            type="monotone"
            dataKey="actual"
            stroke={COLORS.actualLine}
            strokeWidth={3}
            dot={{ r: showWeekly ? 2 : 4, strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};