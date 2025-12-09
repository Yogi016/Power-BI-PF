import React, { useState, useEffect } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { updateActivityDates } from '../lib/supabase';
import { Loader2, Maximize2, Minimize2, BarChart3, Calendar as CalendarIcon } from 'lucide-react';

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

  // Convert activities to Gantt tasks
  useEffect(() => {
    try {
      const ganttTasks: Task[] = activities
        .filter(activity => {
          // Filter out activities without valid dates
          return activity.startDate && activity.endDate;
        })
        .map(activity => {
          const start = new Date(activity.startDate);
          const end = new Date(activity.endDate);
          
          // Validate dates
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.warn(`Invalid dates for activity ${activity.code}:`, activity);
            return null;
          }
          
          // Calculate progress (mock for now, can be enhanced)
          const progress = activity.status === 'completed' ? 100 : 
                          activity.status === 'in-progress' ? 50 : 0;

          return {
            id: activity.id,
            name: `${activity.code} - ${activity.activityName}`,
            start: start,
            end: end,
            progress: progress,
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

  // Handle task date change (drag-to-reschedule)
  const handleTaskChange = async (task: Task) => {
    setLoading(true);
    
    try {
      // Update in database
      const success = await updateActivityDates(
        task.id,
        task.start.toISOString().split('T')[0],
        task.end.toISOString().split('T')[0]
      );

      if (success) {
        // Update local state
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        
        // Notify parent component
        if (onActivityUpdate) {
          onActivityUpdate();
        }
      } else {
        console.error('Failed to update activity dates');
        // Revert changes by reloading
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating activity:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle double click (optional: could open edit modal)
  const handleDoubleClick = (task: Task) => {
    console.log('Double clicked:', task.name);
    // Could open a modal for detailed editing
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border-2 border-dashed border-slate-300 shadow-sm p-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <CalendarIcon size={40} className="text-white" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Belum Ada Activities
        </h3>
        <p className="text-slate-600 mb-4">
          Tambahkan activities dengan Start Date dan End Date di Manage Data untuk melihat Gantt Chart
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
          <BarChart3 size={16} />
          <span>Timeline visualization akan muncul di sini</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'bg-white rounded-xl border border-slate-200 shadow-lg'} overflow-hidden transition-all duration-300`}>
      {/* Enhanced Header with Gradient */}
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
            {/* Chart/Timeline Toggle */}
            <div className="flex bg-white/20 backdrop-blur-sm rounded-lg p-1">
              <button
                onClick={() => setShowChart(true)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  showChart
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} />
                  <span>Timeline</span>
                </div>
              </button>
              <button
                onClick={() => setShowChart(false)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  !showChart
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} />
                  <span>Diagram</span>
                </div>
              </button>
            </div>

            {/* Fullscreen Toggle */}
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
            <button
              onClick={() => setViewMode(ViewMode.Day)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === ViewMode.Day
                  ? 'bg-white text-blue-600 shadow-lg'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode(ViewMode.Week)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === ViewMode.Week
                  ? 'bg-white text-blue-600 shadow-lg'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode(ViewMode.Month)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === ViewMode.Month
                  ? 'bg-white text-blue-600 shadow-lg'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Month
            </button>
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
          // Gantt Timeline View
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
          // Diagram View (Simple Bar Chart)
          <div className="p-6">
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-8">
              <h4 className="text-lg font-bold text-slate-900 mb-6">Progress Overview</h4>
              <div className="space-y-4">
                {tasks.map((task, index) => (
                  <div key={task.id} className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-900 text-sm">{task.name}</span>
                      <span className="text-sm font-bold text-blue-600">{task.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-emerald-500"
                        style={{ width: `${task.progress}%` }}
                      ></div>
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

      {/* Enhanced Legend */}
      <div className="p-4 border-t-2 border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <span className="font-bold text-slate-700">Status Legend:</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md shadow-sm" style={{ backgroundColor: '#22c55e' }}></div>
              <span className="text-slate-700 font-medium">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md shadow-sm" style={{ backgroundColor: '#3b82f6' }}></div>
              <span className="text-slate-700 font-medium">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md shadow-sm" style={{ backgroundColor: '#eab308' }}></div>
              <span className="text-slate-700 font-medium">On Hold</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md shadow-sm" style={{ backgroundColor: '#94a3b8' }}></div>
              <span className="text-slate-700 font-medium">Not Started</span>
            </div>
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
