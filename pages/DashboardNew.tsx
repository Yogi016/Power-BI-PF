import React, { useState, useEffect, useMemo } from 'react';
import { ProjectHeader } from '../components/ProjectHeader';
import { ProgressMetrics } from '../components/ProgressMetrics';
import { SCurveChart } from '../components/SCurveChart';
import { TimelineSelector } from '../components/TimelineSelector';
import { ProjectSelector } from '../components/ProjectSelector';
import { FilterPanel } from '../components/FilterPanel';
import { Project, ProjectMetrics, PeriodType, SCurveDataPoint } from '../types';
import { fetchProjects, fetchSCurveData, fetchProjectMetrics } from '../lib/supabase';
import { FilterState, applyFilters, getDefaultFilters, saveFilters, loadFilters } from '../lib/filterUtils';
import { generateWeeklyReport } from '../lib/weeklyReportUtils';
import { Loader2, TrendingUp, FileText } from 'lucide-react';

export const DashboardNew: React.FC = () => {
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('monthly');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [sCurveData, setSCurveData] = useState<SCurveDataPoint[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState<FilterState>(() => {
    const saved = loadFilters('dashboardFilters');
    return saved || getDefaultFilters();
  });

  // Save filters to localStorage when changed
  useEffect(() => {
    saveFilters('dashboardFilters', filters);
  }, [filters]);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      const projectsData = await fetchProjects();
      setProjects(projectsData);
      
      // Auto-select first project if available
      if (projectsData.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectsData[0].id);
      }
      
      setLoading(false);
    };

    loadProjects();
  }, []);

  // Load S-Curve data when project or period changes
  useEffect(() => {
    const loadSCurveData = async () => {
      if (!selectedProjectId) {
        // Load aggregated data from all projects
        const { fetchAllProjectsSCurveData } = await import('../lib/supabase');
        const data = await fetchAllProjectsSCurveData(selectedPeriod);
        setSCurveData(data);
        return;
      }

      const data = await fetchSCurveData(selectedProjectId, selectedPeriod);
      setSCurveData(data);
    };

    loadSCurveData();
  }, [selectedProjectId, selectedPeriod]);

  // Load metrics when project changes
  useEffect(() => {
    const loadMetrics = async () => {
      if (!selectedProjectId) {
        setMetrics(null);
        return;
      }

      const metricsData = await fetchProjectMetrics(selectedProjectId);
      setMetrics(metricsData);
    };

    loadMetrics();
  }, [selectedProjectId]);

  // Apply filters to projects
  const filteredProjects = useMemo(() => {
    return applyFilters(projects, filters);
  }, [projects, filters]);

  // Get selected project
  const selectedProject = useMemo(() => {
    return filteredProjects.find(p => p.id === selectedProjectId) || null;
  }, [filteredProjects, selectedProjectId]);

  // Get available years from S-Curve data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    sCurveData.forEach(d => years.add(d.year));
    return Array.from(years).sort();
  }, [sCurveData]);

  // Filter S-Curve data by selected year
  const displayData = useMemo(() => {
    if (!selectedYear) return sCurveData;
    return sCurveData.filter(d => d.year === selectedYear);
  }, [sCurveData, selectedYear]);

  // Calculate display metrics (aggregate if no project selected)
  const displayMetrics = useMemo(() => {
    if (selectedProject) return metrics || {
      totalActivities: 0,
      completedActivities: 0,
      inProgressActivities: 0,
      delayedActivities: 0,
      overallProgress: 0,
      plannedProgress: 0,
      variance: 0,
      daysRemaining: 0,
      completionRate: 0,
    };
    
    // Aggregate metrics from all filtered projects
    // This is a simplified version - you might want more sophisticated aggregation
    return null;
  }, [selectedProject, metrics]);

  // Handle weekly report generation
  const handleGenerateReport = async () => {
    if (!selectedProjectId) {
      alert('Please select a project first');
      return;
    }

    setGeneratingReport(true);
    try {
      await generateWeeklyReport(selectedProjectId);
      alert('Weekly report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Convert S-Curve data to chart format
  const chartData = useMemo(() => {
    return displayData.map(d => ({
      month: d.periodLabel,
      plan: d.baseline,
      actual: d.actual,
      variance: d.variance,
      daysRemaining: 0,
      completionRate: 0,
    }));
  }, [displayData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Memuat data project...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={32} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            Belum Ada Project
          </h3>
          <p className="text-slate-600 mb-6">
            Silakan setup database Supabase Anda terlebih dahulu dan jalankan schema SQL.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-md mx-auto">
            <p className="text-sm text-blue-900 font-medium mb-2">
              📝 Langkah Setup:
            </p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Buka folder <code className="bg-blue-100 px-1 rounded">supabase/</code></li>
              <li>Ikuti instruksi di <code className="bg-blue-100 px-1 rounded">README.md</code></li>
              <li>Jalankan <code className="bg-blue-100 px-1 rounded">schema.sql</code> dan <code className="bg-blue-100 px-1 rounded">seed.sql</code></li>
              <li>Setup file <code className="bg-blue-100 px-1 rounded">.env.local</code></li>
              <li>Restart aplikasi</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Project Header */}
        {selectedProject && <ProjectHeader project={selectedProject} />}

        {/* Filters & Project Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <FilterPanel
            projects={projects}
            filters={filters}
            onFiltersChange={setFilters}
          />
          
          <ProjectSelector
            projects={filteredProjects}
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
          />
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Periode Tampilan
            </label>
            <TimelineSelector
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              selectedYear={selectedYear}
              availableYears={availableYears}
              onYearChange={setSelectedYear}
            />
            
            {/* Generate Weekly Report Button */}
            {selectedProjectId && (
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-3 rounded-lg font-medium transition-all shadow-lg disabled:cursor-not-allowed"
              >
                {generatingReport ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    Generate Weekly Report
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Progress Metrics */}
        {selectedProject && <ProgressMetrics metrics={displayMetrics} />}

        {/* S-Curve Chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Diagram S-Curve {!selectedProjectId && '- Semua Project'}
            </h2>
            <p className="text-slate-600">
              {selectedProjectId 
                ? 'Grafik perbandingan progress baseline (rencana) vs actual (realisasi)'
                : 'Grafik rata-rata progress dari semua project'}
            </p>
          </div>

          {chartData.length > 0 ? (
            <SCurveChart 
              data={chartData}
              showWeekly={selectedPeriod === 'weekly'}
              yearLabel={selectedYear?.toString()}
            />
          ) : (
            <div className="h-[400px] flex items-center justify-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
              <div className="text-center">
                <p className="text-slate-500 font-medium">
                  Tidak ada data S-Curve untuk project ini
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Silakan tambahkan data di database Supabase
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Sistem Pemantauan Progress Project
              </h3>
              <p className="text-slate-700 text-sm leading-relaxed">
                Dashboard ini menampilkan informasi real-time dari database Supabase. 
                Semua data progress, aktivitas, dan metrics diupdate secara otomatis. 
                Gunakan filter project dan periode untuk melihat detail yang Anda butuhkan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
