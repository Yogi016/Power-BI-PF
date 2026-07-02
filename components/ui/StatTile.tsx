import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: number; // signed percent; omit if not applicable
}

export const StatTile: React.FC<StatTileProps> = ({ label, value, icon, trend }) => {
  const pos = trend !== undefined && trend > 0;
  const zero = trend === 0;
  const trendCls = zero ? 'text-slate-600 bg-slate-100' : pos ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100';
  const TrendIcon = zero ? Minus : pos ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 transition hover:border-slate-300">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-tight text-slate-500">{label}</p>
          <h3 className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</h3>
        </div>
        {icon && <div className="p-2 rounded-lg bg-blue-50 text-[#0066cc]">{icon}</div>}
      </div>
      {trend !== undefined && (
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${trendCls}`}>
            <TrendIcon size={14} />{Math.abs(trend)}%
          </span>
        </div>
      )}
    </div>
  );
};
