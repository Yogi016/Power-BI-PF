import React, { useState, useEffect, useRef } from 'react';
import { GanttChart } from '../components/GanttChart';
import { fetchProjects, fetchActivities } from '../lib/supabase';
import { exportToPDF, exportToExcel } from '../lib/exportUtils';
import { Project } from '../types';
import { Loader2, Calendar, FileDown, FileSpreadsheet } from 'lucide-react';

export const GanttPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const ganttRef = useRef<HTMLDivElement>(null);

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

  // Export handlers
  const handleExportPDF = async () => {
    if (!selectedProject || activities.length === 0) {
      alert('Tidak ada data untuk di-export');
      return;
    }

    setExporting(true);
    try {
      const exportData = {
        projectName: selectedProject.name,
        pic: selectedProject.pic || '-',
        activities: activities.map(a => ({
          code: a.code || '-',
          activityName: a.activityName || a.activity || '-',
          startDate: a.startDate || '-',
          endDate: a.endDate || '-',
          status: a.status || 'not-started',
          weight: a.weight || 0,
          progress: a.progress,
        })),
        metrics: {
          totalProgress: activities.reduce((sum, a) => sum + (a.progress || 0), 0) / activities.length,
          completedActivities: activities.filter(a => a.status === 'completed').length,
          totalActivities: activities.length,
        },
      };

      await exportToPDF(exportData, ganttRef.current || undefined);
    } catch (error) {
      console.error('Export PDF error:', error);
      alert('Gagal export PDF. Silakan coba lagi.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (!selectedProject || activities.length === 0) {
      alert('Tidak ada data untuk di-export');
      return;
    }

    setExporting(true);
    try {
      const exportData = {
        projectName: selectedProject.name,
        pic: selectedProject.pic || '-',
        activities: activities.map(a => ({
          code: a.code || '-',
          activityName: a.activityName || a.activity || '-',
          startDate: a.startDate || '-',
          endDate: a.endDate || '-',
          status: a.status || 'not-started',
          weight: a.weight || 0,
          progress: a.progress,
        })),
        metrics: {
          totalProgress: activities.reduce((sum, a) => sum + (a.progress || 0), 0) / activities.length,
          completedActivities: activities.filter(a => a.status === 'completed').length,
          totalActivities: activities.length,
        },
      };

      exportToExcel(exportData);
    } catch (error) {
      console.error('Export Excel error:', error);
      alert('Gagal export Excel. Silakan coba lagi.');
    } finally {
      setExporting(false);
    }
  };

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
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-[1800px] mx-auto space-y-4 sm:space-y-6">
        {/* Enhanced Project Selector */}
        <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-xl p-4 sm:p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar size={20} className="sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Gantt Chart Timeline</h2>
              <p className="text-blue-100 text-xs sm:text-sm">Visualisasi timeline project dengan drag-to-reschedule</p>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <label className="block text-sm font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Pilih Project
              </label>
              
              {/* Export Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleExportPDF}
                  disabled={exporting || !selectedProjectId || activities.length === 0}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-all border border-white/30"
                  title="Export to PDF"
                >
                  <FileDown size={16} />
                  <span>PDF</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={exporting || !selectedProjectId || activities.length === 0}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-all border border-white/30"
                  title="Export to Excel"
                >
                  <FileSpreadsheet size={16} />
                  <span>Excel</span>
                </button>
              </div>
            </div>
            
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border-2 border-blue-200 rounded-lg text-slate-900 text-sm sm:text-base font-medium focus:ring-4 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all shadow-sm hover:shadow-md"
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
        <div ref={ganttRef}>
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
    </div>
  );
};
