import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Filter, Loader2 } from 'lucide-react';
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
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2 sm:gap-3">
            <span className="p-1.5 sm:p-2 bg-slate-100 rounded-lg">
              <CalendarIcon size={20} className="text-indigo-600 sm:hidden" />
              <CalendarIcon size={24} className="text-indigo-600 hidden sm:block" />
            </span>
            Calendar View
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Visualisasi aktivitas dalam format kalender interaktif</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6 animate-in slide-in-from-bottom-4 duration-500">
        {/* Project Selector */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6 group">
          <div className="space-y-1 mb-4 flex justify-between items-start">
            <div>
              <label className="text-sm font-semibold leading-none tracking-tight text-slate-900">
                Pilih Project
              </label>
              <p className="text-sm text-slate-500 mt-1">Filter kalender berdasarkan proyek pengawasan.</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-md shrink-0 transition-colors group-hover:bg-slate-100">
              <Filter size={18} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
            </div>
          </div>
          <select
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em] bg-[right_0.75rem_center] bg-no-repeat cursor-pointer group-hover:border-slate-300"
          >
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name} • {project.pic}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 group">
          <div className="space-y-1 mb-4 flex justify-between items-start">
            <div>
              <label className="text-sm font-semibold leading-none tracking-tight text-slate-900">
                Filter Status
              </label>
              <p className="text-sm text-slate-500 mt-1">Tampilkan aktivitas berdasarkan status saat ini.</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-md shrink-0 transition-colors group-hover:bg-slate-100">
              <Filter size={18} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em] bg-[right_0.75rem_center] bg-no-repeat cursor-pointer group-hover:border-slate-300"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-12 flex items-center justify-center animate-in fade-in duration-500 h-[700px]">
          <div className="text-center flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-slate-400" size={40} />
            <p className="text-slate-500 font-medium">Memuat kalender kegiatan...</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700 p-4" style={{ minHeight: '700px' }}>
          <CalendarView
            events={events}
            onEventClick={handleEventClick}
            onEventDrop={handleEventDrop}
            onSelectSlot={handleSelectSlot}
          />
        </div>
      )}

      {/* Legend */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 animate-in fade-in duration-700 delay-100">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-2">Status Legend</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-md bg-slate-400 shadow-sm border border-slate-500/20"></div>
            <span className="text-sm font-medium text-slate-600">Belum Dimulai</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-md bg-blue-500 shadow-sm border border-blue-600/20"></div>
            <span className="text-sm font-medium text-slate-600">Sedang Berjalan</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-md bg-green-500 shadow-sm border border-green-600/20"></div>
            <span className="text-sm font-medium text-slate-600">Selesai</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-md bg-red-500 shadow-sm border border-red-600/20"></div>
            <span className="text-sm font-medium text-slate-600">Terlambat</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-md bg-orange-500 shadow-sm border border-orange-600/20"></div>
            <span className="text-sm font-medium text-slate-600">Ditunda</span>
          </div>
        </div>
      </div>
    </div>
  );
};
