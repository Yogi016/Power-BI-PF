import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: number;
  icon?: React.ReactNode;
  trendLabel?: string;
}

export const StatCard: React.FC<Props> = ({ title, value, subtext, trend, icon, trendLabel }) => {
  const isPositive = trend && trend > 0;
  const isNeutral = trend === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-300 group animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-semibold tracking-tight leading-none text-slate-500">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{value}</h3>
        </div>
        {icon && (
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 transition-transform group-hover:scale-110 group-hover:-translate-y-1">
            {icon}
          </div>
        )}
      </div>

      {(trend !== undefined || subtext) && (
        <div className="flex items-center text-sm mt-4 border-t border-slate-100 pt-4">
          {trend !== undefined && (
            <span className={`flex items-center font-medium mr-2 ${isNeutral ? 'text-slate-600 bg-slate-100' : isPositive ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100'
              } px-2 py-0.5 rounded-full text-xs`}>
              {isNeutral ? <Minus size={14} className="mr-1" /> : isPositive ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
              {Math.abs(trend)}%
            </span>
          )}
          {trendLabel && <span className="text-slate-500 mr-2">{trendLabel}</span>}
          {subtext && <span className="text-slate-500">{subtext}</span>}
        </div>
      )}
    </div>
  );
};