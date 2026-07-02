import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Circle } from 'lucide-react';

export type Status = 'positive' | 'warning' | 'danger' | 'neutral';

const STYLES: Record<Status, { cls: string; Icon: React.ComponentType<any> }> = {
  positive: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  warning:  { cls: 'bg-amber-50 text-amber-700 border-amber-200',       Icon: AlertTriangle },
  danger:   { cls: 'bg-red-50 text-red-700 border-red-200',             Icon: XCircle },
  neutral:  { cls: 'bg-slate-100 text-slate-600 border-slate-200',      Icon: Circle },
};

export const StatusBadge: React.FC<{ status: Status; label: string }> = ({ status, label }) => {
  const { cls, Icon } = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <Icon size={14} />
      {label}
    </span>
  );
};
