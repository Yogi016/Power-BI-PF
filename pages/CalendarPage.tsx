import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Filter } from 'lucide-react';
import { CalendarView } from '../components/CalendarView';
import { CalendarEvent } from '../types';
import { fetchProjects, fetchActivities } from '../lib/supabase';
import '../styles/calendar.css';

interface Project {
  id: string;
  name: string;
  pic: string;
}

// Activity interface matching fetchActivities return type
interface Activity {
  id: string;
  code: string;
  activityName: string;
  startDate: string;
  endDate: string;
  status: string;
  pic: string;
  weight: number;
}

export const CalendarPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Fetch activities when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadActivities(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Transform activities to calendar events
  useEffect(() => {
    const calendarEvents: CalendarEvent[] = activities
      .filter(activity => activity.startDate && activity.endDate)
      .filter(activity => statusFilter === 'all' || activity.status === statusFilter)
      .map(activity => ({
        id: activity.id,
        title: `${activity.code} - ${activity.activityName}`,
        start: new Date(activity.startDate),
        end: new Date(activity.endDate),
        resource: {
          activityId: activity.id,
          projectId: selectedProjectId || '',
          projectName: projects.find(p => p.id === selectedProjectId)?.name || '',
          status: activity.status,
          pic: activity.pic,
          code: activity.code,
          weight: activity.weight,
        },
      }));

    setEvents(calendarEvents);
  }, [activities, statusFilter, selectedProjectId, projects]);

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      if (data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadActivities = async (projectId: string) => {
    setLoading(true);
    try {
      const data = await fetchActivities(projectId);
      setActivities(data as any as Activity[]);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    // TODO: Show event details modal
    console.log('Event clicked:', event);
    alert(`Activity: ${event.title}\nStatus: ${event.resource.status}\nPIC: ${event.resource.pic}`);
  };

  const handleEventDrop = async (event: CalendarEvent, start: Date, end: Date) => {
    // TODO: Update activity dates in database
    console.log('Event dropped:', event, start, end);
    
    // Optimistic update
    const updatedActivities = activities.map(activity => {
      if (activity.id === event.resource.activityId) {
        return {
          ...activity,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        };
      }
      return activity;
    });
    
    setActivities(updatedActivities);
  };

  const handleSelectSlot = (slotInfo: any) => {
    // TODO: Create new activity
    console.log('Slot selected:', slotInfo);
  };

  const statusOptions = [
    { value: 'all', label: 'Semua Status' },
    { value: 'not-started', label: 'Belum Dimulai' },
    { value: 'in-progress', label: 'Sedang Berjalan' },
    { value: 'completed', label: 'Selesai' },
    { value: 'delayed', label: 'Terlambat' },
    { value: 'on-hold', label: 'Ditunda' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-[1800px] mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
              <CalendarIcon size={20} className="sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Calendar View</h2>
              <p className="text-blue-100 text-xs sm:text-sm">Visualisasi aktivitas dalam format kalender</p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Project Filter */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/20">
              <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Filter size={16} />
                Pilih Project
              </label>
              <select
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border-2 border-blue-200 rounded-lg text-slate-900 text-sm sm:text-base font-medium focus:ring-4 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
              >
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name} • {project.pic}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/20">
              <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Filter size={16} />
                Filter Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border-2 border-blue-200 rounded-lg text-slate-900 text-sm sm:text-base font-medium focus:ring-4 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-12 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Memuat kalender...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ minHeight: '700px' }}>
            <CalendarView
              events={events}
              onEventClick={handleEventClick}
              onEventDrop={handleEventDrop}
              onSelectSlot={handleSelectSlot}
            />
          </div>
        )}

        {/* Legend */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Status Legend</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-400"></div>
              <span className="text-xs sm:text-sm text-slate-600">Belum Dimulai</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span className="text-xs sm:text-sm text-slate-600">Sedang Berjalan</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-xs sm:text-sm text-slate-600">Selesai</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-xs sm:text-sm text-slate-600">Terlambat</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-500"></div>
              <span className="text-xs sm:text-sm text-slate-600">Ditunda</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
