import React, { useState, useEffect, useMemo } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { updateActivityDates } from '../lib/supabase';
import { Loader2, Maximize2, Minimize2, BarChart3, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface Activity {
  id: string;
  code: string;
  activityName: string;
  startDate: string;
  endDate: string;
  status: string;
  pic: string;
  weight?: number;
}

interface GanttChartProps {
  projectId: string;
  activities: Activity[];
  onActivityUpdate?: () => void;
}

// Get color based on status
const getStatusColor = (status: string, selected: boolean = false): string => {
  const colors: Record<string, { normal: string; selected: string }> = {
    'completed': { normal: '#22c55e', selected: '#16a34a' },
    'in-progress': { normal: '#3b82f6', selected: '#2563eb' },
    'active': { normal: '#3b82f6', selected: '#2563eb' },
    'on-hold': { normal: '#eab308', selected: '#ca8a04' },
    'cancelled': { normal: '#ef4444', selected: '#dc2626' },
    'not-started': { normal: '#94a3b8', selected: '#64748b' },
  };

  const color = colors[status.toLowerCase()] || colors['not-started'];
  return selected ? color.selected : color.normal;
};

export const GanttChart: React.FC<GanttChartProps> = ({
  projectId,
  activities,
  onActivityUpdate,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Convert activities to Gantt tasks
  useEffect(() => {
    try {
      const ganttTasks: Task[] = activities
        .filter(activity => activity.startDate && activity.endDate)
        .map(activity => {
          const start = new Date(activity.startDate);
          const end = new Date(activity.endDate);

          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return null;
          }

          const progress = activity.status === 'completed' ? 100 :
            activity.status === 'in-progress' ? 50 : 0;

          return {
            id: activity.id,
            name: `${activity.code} - ${activity.activityName}`,
            start,
            end,
            progress,
            type: 'task' as const,
            styles: {
              backgroundColor: getStatusColor(activity.status),
              backgroundSelectedColor: getStatusColor(activity.status, true),
              progressColor: '#4ade80',
              progressSelectedColor: '#22c55e',
            },
          };
        })
        .filter((task): task is Task => task !== null);

      setTasks(ganttTasks);
    } catch (error) {
      console.error('Error converting activities to Gantt tasks:', error);
      setTasks([]);
    }
  }, [activities]);

  // Handle task date change (drag-to-reschedule)
  const handleTaskChange = async (task: Task) => {
    setLoading(true);
    try {
      const success = await updateActivityDates(
        task.id,
        task.start.toISOString().split('T')[0],
        task.end.toISOString().split('T')[0]
      );
      if (success) {
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        if (onActivityUpdate) onActivityUpdate();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDoubleClick = (task: Task) => {
    console.log('Double clicked:', task.name);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Empty state
  if (tasks.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border-2 border-dashed border-slate-300 shadow-sm p-6 sm:p-12 text-center">
        <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
          <CalendarIcon size={isMobile ? 28 : 40} className="text-white" />
        </div>
        <h3 className="text-base sm:text-xl font-bold text-slate-900 mb-2">
          Belum Ada Activities
        </h3>
        <p className="text-sm sm:text-base text-slate-600 mb-4">
          Tambahkan activities dengan Start Date dan End Date di Manage Data untuk melihat Gantt Chart
        </p>
        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs sm:text-sm font-medium">
          <BarChart3 size={16} />
          <span>Timeline visualization akan muncul di sini</span>
        </div>
      </div>
    );
  }

  // ===== MOBILE: Calendar View =====
  if (isMobile) {
    return (
      <MobileCalendarView
        activities={activities}
      />
    );
  }

  // ===== DESKTOP: Original Gantt Chart =====
  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'bg-white rounded-xl border border-slate-200 shadow-lg'} overflow-hidden transition-all duration-300`}>
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <CalendarIcon size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Gantt Chart Timeline</h3>
              <p className="text-blue-100 text-sm mt-1">
                Drag bars untuk reschedule • {tasks.length} activities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white/20 backdrop-blur-sm rounded-lg p-1">
              <button
                onClick={() => setShowChart(true)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${showChart ? 'bg-white text-blue-600 shadow-lg' : 'text-white hover:bg-white/10'}`}
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} />
                  <span>Timeline</span>
                </div>
              </button>
              <button
                onClick={() => setShowChart(false)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${!showChart ? 'bg-white text-blue-600 shadow-lg' : 'text-white hover:bg-white/10'}`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} />
                  <span>Diagram</span>
                </div>
              </button>
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg transition-all text-white"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
          </div>
        </div>

        {/* View Mode Controls */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-white text-sm font-medium">View Mode:</span>
          <div className="flex bg-white/20 backdrop-blur-sm rounded-lg p-1">
            {[ViewMode.Day, ViewMode.Week, ViewMode.Month].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === mode ? 'bg-white text-blue-600 shadow-lg' : 'text-white hover:bg-white/10'}`}
              >
                {mode === ViewMode.Day ? 'Day' : mode === ViewMode.Week ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className={`relative ${isFullscreen ? 'h-[calc(100vh-200px)]' : 'min-h-[500px]'} overflow-auto`}>
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 backdrop-blur-sm">
            <div className="text-center">
              <Loader2 size={48} className="animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Updating timeline...</p>
            </div>
          </div>
        )}

        {showChart ? (
          <div className="p-6">
            <Gantt
              tasks={tasks}
              viewMode={viewMode}
              onDateChange={handleTaskChange}
              onDoubleClick={handleDoubleClick}
              listCellWidth="250px"
              columnWidth={viewMode === ViewMode.Month ? 350 : viewMode === ViewMode.Week ? 120 : 80}
              barCornerRadius={6}
              barFill={65}
              todayColor="rgba(59, 130, 246, 0.15)"
              locale="id-ID"
            />
          </div>
        ) : (
          <div className="p-6">
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-8">
              <h4 className="text-lg font-bold text-slate-900 mb-6">Progress Overview</h4>
              <div className="space-y-4">
                {tasks.map(task => (
                  <div key={task.id} className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-900 text-sm">{task.name}</span>
                      <span className="text-sm font-bold text-blue-600">{task.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-emerald-500"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-slate-600">
                      <span>{task.start.toLocaleDateString('id-ID')}</span>
                      <span>→</span>
                      <span>{task.end.toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-4 border-t-2 border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <span className="font-bold text-slate-700">Status Legend:</span>
            {[
              { color: '#22c55e', label: 'Completed' },
              { color: '#3b82f6', label: 'In Progress' },
              { color: '#eab308', label: 'On Hold' },
              { color: '#94a3b8', label: 'Not Started' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md shadow-sm" style={{ backgroundColor: item.color }} />
                <span className="text-slate-700 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
          {showChart && (
            <div className="text-xs text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
              💡 <span className="font-medium">Tip:</span> Double-click activity untuk detail
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =====================================================
// MOBILE CALENDAR VIEW
// =====================================================
const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const STATUS_LABELS: Record<string, string> = {
  'completed': 'Selesai',
  'in-progress': 'Berjalan',
  'active': 'Aktif',
  'on-hold': 'Ditunda',
  'cancelled': 'Dibatalkan',
  'not-started': 'Belum Mulai',
};

interface MobileCalendarViewProps {
  activities: Activity[];
}

const MobileCalendarView: React.FC<MobileCalendarViewProps> = ({ activities }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Filter valid activities
  const validActivities = useMemo(
    () =>
      activities.filter(a => {
        if (!a.startDate || !a.endDate) return false;
        const s = new Date(a.startDate);
        const e = new Date(a.endDate);
        return !isNaN(s.getTime()) && !isNaN(e.getTime());
      }),
    [activities]
  );

  // Build map: dateKey => activities[] on that date
  const dateActivityMap = useMemo(() => {
    const map = new Map<string, Activity[]>();
    validActivities.forEach(act => {
      const start = new Date(act.startDate);
      const end = new Date(act.endDate);
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      const endNorm = new Date(end);
      endNorm.setHours(0, 0, 0, 0);
      while (cursor <= endNorm) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
        const existing = map.get(key) || [];
        existing.push(act);
        map.set(key, existing);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [validActivities]);

  // Calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startPad = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(currentYear, currentMonth, d));
    }
    return days;
  }, [currentMonth, currentYear]);

  // Activities for selected date
  const selectedActivities = useMemo(() => {
    if (!selectedDate) return [];
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    return dateActivityMap.get(key) || [];
  }, [selectedDate, dateActivityMap]);

  const goToPrev = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
    setSelectedDate(null);
  };

  const goToNext = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDate(today);
  };

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const isSelected = (d: Date) =>
    selectedDate !== null &&
    d.getDate() === selectedDate.getDate() &&
    d.getMonth() === selectedDate.getMonth() &&
    d.getFullYear() === selectedDate.getFullYear();

  const formatDateFull = (d: Date) =>
    d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon size={18} className="text-white" />
            <h3 className="text-base font-bold text-white">Kalender Aktivitas</h3>
          </div>
          <span className="text-blue-100 text-xs">{validActivities.length} aktivitas</span>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <button
          onClick={goToPrev}
          className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 active:bg-slate-300 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <h4 className="text-sm font-bold text-slate-900">
            {MONTHS_ID[currentMonth]} {currentYear}
          </h4>
          <button onClick={goToToday} className="text-[11px] text-indigo-600 font-medium mt-0.5">
            Hari ini
          </button>
        </div>
        <button
          onClick={goToNext}
          className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 active:bg-slate-300 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="px-2 py-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_ID.map(day => (
            <div key={day} className="text-center text-[11px] font-semibold text-slate-400 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-[2px]">
          {calendarDays.map((date, i) => {
            if (!date) {
              return <div key={`pad-${i}`} className="aspect-square" />;
            }

            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const dayActivities = dateActivityMap.get(key) || [];
            const hasActivities = dayActivities.length > 0;
            const todayClass = isToday(date);
            const selectedClass = isSelected(date);

            // Get unique status colors (max 3 dots)
            const uniqueStatuses = [...new Set(dayActivities.map(a => a.status))].slice(0, 3);

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(date)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all ${selectedClass
                    ? 'bg-indigo-600 text-white shadow-md scale-105'
                    : todayClass
                      ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-300'
                      : hasActivities
                        ? 'bg-slate-50 text-slate-900 active:bg-slate-200'
                        : 'text-slate-400'
                  }`}
              >
                <span className={`text-xs font-medium leading-none ${selectedClass ? 'font-bold' : ''}`}>
                  {date.getDate()}
                </span>
                {/* Activity dots */}
                {hasActivities && (
                  <div className="flex gap-[2px] mt-1">
                    {uniqueStatuses.map((status, idx) => (
                      <div
                        key={idx}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: selectedClass ? 'rgba(255,255,255,0.8)' : getStatusColor(status),
                        }}
                      />
                    ))}
                  </div>
                )}
                {/* Activity count badge */}
                {dayActivities.length > 2 && !selectedClass && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {dayActivities.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detail */}
      {selectedDate && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            {formatDateFull(selectedDate)}
          </h4>

          {selectedActivities.length === 0 ? (
            <div className="text-center py-6">
              <CalendarIcon size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">Tidak ada aktivitas di tanggal ini</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedActivities.map(act => (
                <div
                  key={act.id}
                  className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-1 min-h-[40px] rounded-full flex-shrink-0 self-stretch"
                      style={{ backgroundColor: getStatusColor(act.status) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 leading-snug">
                          {act.code} - {act.activityName}
                        </p>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                          style={{
                            backgroundColor: getStatusColor(act.status) + '20',
                            color: getStatusColor(act.status),
                          }}
                        >
                          {STATUS_LABELS[act.status.toLowerCase()] || act.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-500">
                        <Clock size={10} />
                        <span>
                          {new Date(act.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          {' → '}
                          {new Date(act.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="font-semibold text-slate-500">Legend:</span>
          {[
            { color: '#22c55e', label: 'Selesai' },
            { color: '#3b82f6', label: 'Berjalan' },
            { color: '#eab308', label: 'Ditunda' },
            { color: '#94a3b8', label: 'Belum Mulai' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
