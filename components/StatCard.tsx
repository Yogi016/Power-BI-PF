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
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
        </div>
        {icon && (
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            {icon}
          </div>
        )}
      </div>
      
      {(trend !== undefined || subtext) && (
        <div className="flex items-center text-sm">
          {trend !== undefined && (
            <span className={`flex items-center font-medium mr-2 ${
              isNeutral ? 'text-slate-500' : isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isNeutral ? <Minus size={16} /> : isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              {Math.abs(trend)}%
            </span>
          )}
          {trendLabel && <span className="text-slate-400 mr-2">{trendLabel}</span>}
          {subtext && <span className="text-slate-400">{subtext}</span>}
        </div>
      )}
    </div>
  );
};