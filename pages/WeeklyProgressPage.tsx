import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { fetchProjects, fetchActivities } from '../lib/supabase';
import { WeeklyProgressEditor } from '../components/WeeklyProgressEditor';
import { Loader2, Calendar } from 'lucide-react';

interface Activity {
  id: string;
  code: string;
  name: string;
  pic: string;
}

export const WeeklyProgressPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadActivities(selectedProjectId);
    } else {
      setActivities([]);
      setSelectedActivityId(null);
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    setLoading(true);
    const data = await fetchProjects();
    setProjects(data);
    if (data.length > 0) {
      setSelectedProjectId(data[0].id);
    }
    setLoading(false);
  };

  const loadActivities = async (projectId: string) => {
    try {
      // Fetch real activities from Supabase
      const { supabase } = await import('../lib/supabaseClient');
      if (!supabase) {
        console.error('Supabase not initialized');
        return;
      }

      const { data, error } = await supabase
        .from('activities')
        .select('id, code, activity_name, pic')
        .eq('project_id', projectId)
        .order('code', { ascending: true });

      if (error) {
        console.error('Error fetching activities:', error);
        return;
      }

      const mappedActivities: Activity[] = (data || []).map(row => ({
        id: row.id,
        code: row.code,
        name: row.activity_name,
        pic: row.pic,
      }));

      setActivities(mappedActivities);
      if (mappedActivities.length > 0) {
        setSelectedActivityId(mappedActivities[0].id);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedActivity = activities.find(a => a.id === selectedActivityId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          <p className="text-sm text-slate-500 font-medium">Memuat data progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <span className="p-2 bg-slate-100 rounded-lg">
              <Calendar size={24} className="text-indigo-600" />
            </span>
            Weekly Progress
          </h1>
          <p className="text-slate-500 mt-1">Input progress per minggu untuk setiap activity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 animate-in slide-in-from-bottom-4 duration-500">
        {/* Project Selector */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 group">
          <div className="space-y-1 mb-4">
            <label className="text-sm font-semibold leading-none tracking-tight text-slate-900">
              Pilih Project
            </label>
            <p className="text-sm text-slate-500">Pilih project dari daftar di bawah.</p>
          </div>
          <select
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em] bg-[right_0.75rem_center] bg-no-repeat cursor-pointer group-hover:border-slate-300"
          >
            <option value="" disabled>-- Pilih Project --</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name} - {project.pic}
              </option>
            ))}
          </select>
        </div>

        {/* Activity Selector */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 group">
          <div className="space-y-1 mb-4">
            <label className="text-sm font-semibold leading-none tracking-tight text-slate-900">
              Pilih Activity
            </label>
            <p className="text-sm text-slate-500">Pilih activity khusus berdasarkan nama atau kode.</p>
          </div>
          <select
            value={selectedActivityId || ''}
            onChange={(e) => setSelectedActivityId(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em] bg-[right_0.75rem_center] bg-no-repeat cursor-pointer group-hover:border-slate-300"
            disabled={!selectedProjectId}
          >
            <option value="" disabled>-- Pilih Activity --</option>
            {activities.map(activity => (
              <option key={activity.id} value={activity.id}>
                {activity.code} - {activity.name} ({activity.pic})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Weekly Progress Editor */}
      <div className="animate-in slide-in-from-bottom-4 duration-700">
        {selectedProjectId && selectedActivityId && selectedActivity ? (
          <WeeklyProgressEditor
            projectId={selectedProjectId}
            activityId={selectedActivityId}
            activityName={`${selectedActivity.code} - ${selectedActivity.name}`}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col items-center justify-center p-12 text-center group transition-colors hover:bg-slate-50">
            <div className="rounded-full bg-white border border-slate-200 shadow-sm p-4 mb-4 transition-transform group-hover:scale-105">
              <Calendar className="h-8 w-8 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              Pilih Project dan Activity
            </h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Silakan pilih project dan activity dari menu di atas untuk mulai menginput progress mingguan
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

