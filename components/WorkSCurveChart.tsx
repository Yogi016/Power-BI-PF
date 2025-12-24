import React, { useRef } from 'react';
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
import { WorkDailyData } from '../types';
import html2canvas from 'html2canvas';
import { Download } from 'lucide-react';

interface Props {
  data: WorkDailyData[];
  title: string;
  target: number;
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

export const WorkSCurveChart: React.FC<Props> = ({ data, title, target }) => {
  // Calculate prognosa line: continue from last actual with average rate
  const chartData = data.map((d, idx) => {
    // Find the last actual value
    const lastActualIdx = data.findIndex(item => item.actualCumulative === 0 || item.actualCumulative === undefined) - 1;
    const hasActual = d.actualCumulative > 0;
    
    // Calculate prognosa (projection based on current trend)
    let prognosa = null;
    if (idx > 0 && data.length > 0) {
      const actualData = data.filter(item => item.actualCumulative > 0);
      if (actualData.length > 0) {
        const lastActual = actualData[actualData.length - 1];
        const avgDailyRate = lastActual.actualCumulative / actualData.length;
        const daysFromLastActual = d.dayIndex - lastActual.dayIndex;
        
        if (daysFromLastActual > 0) {
          // Cap prognosa at target - don't exceed target
          prognosa = Math.min(target, lastActual.actualCumulative + (avgDailyRate * daysFromLastActual));
        } else if (hasActual) {
          prognosa = d.actualCumulative;
        }
      }
    }

    return {
      day: d.dayIndex,
      rencana: d.planCumulative,
      realisasi: hasActual ? d.actualCumulative : null,
      prognosa: prognosa,
    };
  });

  // Find max value for Y axis - use target as baseline, only go higher if plan/actual exceeds
  const maxValue = Math.max(
    target,
    ...data.map(d => d.planCumulative || 0),
    ...data.map(d => d.actualCumulative || 0)
  );
  // Round up to nice number, with slight buffer (10%)
  const yAxisMax = Math.ceil(maxValue * 1.1);

  // Ref for chart container
  const chartRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = React.useState(false);

  // Download chart as PNG
  const handleDownload = async () => {
    if (!chartRef.current) return;
    
    setDownloading(true);
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
      });
      
      const link = document.createElement('a');
      link.download = `scurve-${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error downloading chart:', error);
    }
    setDownloading(false);
  };

  return (
    <div className="relative">
      {/* Download button - outside chart capture area */}
      <div className="flex justify-end mb-2">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={16} />
          {downloading ? 'Downloading...' : 'Download PNG'}
        </button>
      </div>
      
      {/* Chart area - this is what gets captured */}
      <div ref={chartRef} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 text-center mb-4">{title}</h3>
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
    </div>
  );
};
