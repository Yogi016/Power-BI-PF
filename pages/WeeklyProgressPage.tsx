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
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={48} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Weekly Progress</h1>
          <p className="text-slate-600">Input progress per minggu untuk setiap activity</p>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Project Selector */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pilih Project
            </label>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">-- Pilih Project --</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name} - {project.pic}
                </option>
              ))}
            </select>
          </div>

          {/* Activity Selector */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pilih Activity
            </label>
            <select
              value={selectedActivityId || ''}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              disabled={!selectedProjectId}
            >
              <option value="">-- Pilih Activity --</option>
              {activities.map(activity => (
                <option key={activity.id} value={activity.id}>
                  {activity.code} - {activity.name} ({activity.pic})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Weekly Progress Editor */}
        {selectedProjectId && selectedActivityId && selectedActivity ? (
          <WeeklyProgressEditor
            projectId={selectedProjectId}
            activityId={selectedActivityId}
            activityName={`${selectedActivity.code} - ${selectedActivity.name}`}
          />
        ) : (
          <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Pilih Project dan Activity
            </h3>
            <p className="text-slate-600">
              Silakan pilih project dan activity untuk mulai input progress mingguan
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
