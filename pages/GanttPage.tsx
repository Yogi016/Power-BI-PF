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
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          <p className="text-sm text-slate-500 font-medium">Memuat Gantt Chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2 sm:gap-3">
            <span className="p-1.5 sm:p-2 bg-slate-100 rounded-lg">
              <Calendar size={20} className="text-indigo-600 sm:hidden" />
              <Calendar size={24} className="text-indigo-600 hidden sm:block" />
            </span>
            Gantt Chart
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Visualisasi timeline project dengan drag-to-reschedule</p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={exporting || !selectedProjectId || activities.length === 0}
            className="group flex items-center justify-center gap-2 rounded-md bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} className="text-slate-500 group-hover:text-red-600 group-hover:-translate-y-0.5 transition-all" />}
            <span className="hidden sm:inline">Export PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting || !selectedProjectId || activities.length === 0}
            className="group flex items-center justify-center gap-2 rounded-md bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} className="text-slate-500 group-hover:text-green-600 group-hover:-translate-y-0.5 transition-all" />}
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col space-y-1.5 p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-1">
              <label htmlFor="project-select" className="text-sm font-medium leading-none text-slate-700">
                Pilih Project
              </label>
              <p className="text-[13px] text-slate-500">Pilih proyek untuk melihat timeline detail.</p>
            </div>
            <select
              id="project-select"
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="flex h-10 w-full sm:w-[320px] items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em] bg-[right_0.75rem_center] bg-no-repeat cursor-pointer"
            >
              <option value="" disabled>Pilih Project...</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name} {project.pic ? `(${project.pic})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gantt Chart Container */}
        <div className="p-3 sm:p-6 overflow-x-auto" ref={ganttRef}>
          {selectedProjectId ? (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <GanttChart
                projectId={selectedProjectId}
                activities={activities}
                onActivityUpdate={() => {
                  fetchActivities(selectedProjectId).then(setActivities);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-100 p-3 mb-4">
                <Calendar className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Belum ada project terpilih</h3>
              <p className="text-sm text-slate-500 mt-1">Silakan pilih sebuah project dari daftar di atas untuk merender timeline Gantt Chart.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

