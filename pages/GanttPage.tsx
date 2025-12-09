import React, { useState, useEffect } from 'react';
import { GanttChart } from '../components/GanttChart';
import { fetchProjects, fetchActivities } from '../lib/supabase';
import { Project } from '../types';
import { Loader2, Calendar } from 'lucide-react';

export const GanttPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      const projectsData = await fetchProjects();
      setProjects(projectsData);
      
      if (projectsData.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectsData[0].id);
      }
      
      setLoading(false);
    };

    loadProjects();
  }, []);

  // Load activities when project changes
  useEffect(() => {
    const loadActivities = async () => {
      if (!selectedProjectId) return;

      const activitiesData = await fetchActivities(selectedProjectId);
      setActivities(activitiesData);
    };

    loadActivities();
  }, [selectedProjectId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Memuat Gantt Chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Enhanced Project Selector */}
        <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Calendar size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Gantt Chart Timeline</h2>
              <p className="text-blue-100 text-sm">Visualisasi timeline project dengan drag-to-reschedule</p>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Pilih Project
            </label>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-blue-200 rounded-lg text-slate-900 font-medium focus:ring-4 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all shadow-sm hover:shadow-md"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id} className="py-2">
                  {project.name} • {project.pic}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gantt Chart */}
        {selectedProjectId && (
          <GanttChart
            projectId={selectedProjectId}
            activities={activities}
            onActivityUpdate={() => {
              // Reload activities after update
              fetchActivities(selectedProjectId).then(setActivities);
            }}
          />
        )}
      </div>
    </div>
  );
};
