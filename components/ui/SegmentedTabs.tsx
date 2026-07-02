import React from 'react';

interface Tab { id: string; label: string; }

interface SegmentedTabsProps {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
}

export const SegmentedTabs: React.FC<SegmentedTabsProps> = ({ tabs, value, onChange }) => (
  <div className="inline-flex rounded-lg bg-slate-100 p-1">
    {tabs.map((t) => {
      const active = t.id === value;
      return (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition active:scale-[0.98] ${
            active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
        </button>
      );
    })}
  </div>
);
