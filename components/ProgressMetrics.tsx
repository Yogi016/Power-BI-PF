import React from 'react';
import { ProjectMetrics } from '../types';
import { TrendingUp, TrendingDown, Target, Activity, Calendar, CheckCircle2 } from 'lucide-react';

interface ProgressMetricsProps {
  metrics: ProjectMetrics;
}

export const ProgressMetrics: React.FC<ProgressMetricsProps> = ({ metrics }) => {
  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-emerald-600';
    if (variance < 0) return 'text-red-600';
    return 'text-slate-600';
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp size={16} className="text-emerald-600" />;
    if (variance < 0) return <TrendingDown size={16} className="text-red-600" />;
    return null;
  };

  const cards = [
    {
      title: 'Overall Progress',
      value: `${metrics.overallProgress.toFixed(1)}%`,
      subtitle: `${metrics.variance >= 0 ? '+' : ''}${metrics.variance.toFixed(1)}% vs Plan`,
      icon: <Activity size={24} className="text-blue-600" />,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      trend: metrics.variance,
    },
    {
      title: 'Planned Progress',
      value: `${metrics.plannedProgress.toFixed(1)}%`,
      subtitle: 'Target saat ini',
      icon: <Target size={24} className="text-amber-600" />,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    {
      title: 'Completion Rate',
      value: `${metrics.completionRate.toFixed(0)}%`,
      subtitle: `${metrics.completedActivities}/${metrics.totalActivities} aktivitas`,
      icon: <CheckCircle2 size={24} className="text-emerald-600" />,
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
    },
    {
      title: 'Days Remaining',
      value: metrics.daysRemaining,
      subtitle: `${Math.floor(metrics.daysRemaining / 7)} minggu lagi`,
      icon: <Calendar size={24} className="text-purple-600" />,
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`
            ${card.bgColor} ${card.borderColor}
            rounded-xl p-6 border-2 shadow-sm
            hover:shadow-md transition-all duration-300
            animate-in fade-in slide-in-from-bottom-4
          `}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-lg ${card.bgColor} border ${card.borderColor}`}>
              {card.icon}
            </div>
            {card.trend !== undefined && (
              <div className="flex items-center gap-1">
                {getVarianceIcon(card.trend)}
              </div>
            )}
          </div>
          
          <div>
            <p className="text-slate-600 text-sm font-medium mb-1">
              {card.title}
            </p>
            <p className="text-3xl font-bold text-slate-900 mb-1">
              {card.value}
            </p>
            <p className={`text-sm font-medium ${card.trend !== undefined ? getVarianceColor(card.trend) : 'text-slate-500'}`}>
              {card.subtitle}
            </p>
          </div>

          {/* Progress bar for percentage metrics */}
          {typeof card.value === 'string' && card.value.includes('%') && (
            <div className="mt-4">
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    parseFloat(card.value) >= 100
                      ? 'bg-emerald-500'
                      : parseFloat(card.value) >= 70
                      ? 'bg-blue-500'
                      : parseFloat(card.value) >= 40
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, parseFloat(card.value))}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
