import React from 'react';
import { PeriodType } from '../types';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';

interface TimelineSelectorProps {
  selectedPeriod: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  selectedYear?: number | null;
  availableYears?: number[];
  onYearChange?: (year: number | null) => void;
}

export const TimelineSelector: React.FC<TimelineSelectorProps> = ({
  selectedPeriod,
  onPeriodChange,
  selectedYear,
  availableYears = [],
  onYearChange,
}) => {
  const periods: { value: PeriodType; label: string; icon: React.ReactNode }[] = [
    { value: 'weekly', label: 'Mingguan', icon: <Calendar size={16} /> },
    { value: 'monthly', label: 'Bulanan', icon: <CalendarDays size={16} /> },
    { value: 'yearly', label: 'Tahunan', icon: <CalendarRange size={16} /> },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period Toggle */}
      <div className="flex bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
        {periods.map((period) => (
          <button
            key={period.value}
            onClick={() => onPeriodChange(period.value)}
            className={`
              px-4 py-2 text-sm font-medium transition-all duration-200
              flex items-center gap-2
              ${
                selectedPeriod === period.value
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }
            `}
          >
            {period.icon}
            <span>{period.label}</span>
          </button>
        ))}
      </div>

      {/* Year Selector */}
      {availableYears.length > 0 && onYearChange && (
        <select
          value={selectedYear ?? ''}
          onChange={(e) => onYearChange(e.target.value ? Number(e.target.value) : null)}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm hover:border-slate-400 transition-colors"
        >
          <option value="">Semua Tahun</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
