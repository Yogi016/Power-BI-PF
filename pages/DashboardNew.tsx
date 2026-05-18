import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ProjectHeader } from '../components/ProjectHeader';
import { ProgressMetrics } from '../components/ProgressMetrics';
import { SCurveChart } from '../components/SCurveChart';
import { ProjectSelector } from '../components/ProjectSelector';
import { Project, ProjectMetrics, SCurveDataPoint } from '../types';
import { fetchAllProjectsSCurveData, fetchProjects, fetchSCurveData, fetchProjectMetrics } from '../lib/supabase';
import { generateWeeklyReport, generateAllProjectsReport } from '../lib/weeklyReportUtils';
import html2canvas from 'html2canvas';
import { Calendar, Loader2, TrendingUp, FileText, Database, Download, BookOpen, ChevronDown, Filter, User } from 'lucide-react';

interface DashboardNewProps {
  onOpenManageDataForSCurve?: (projectId: string | null) => void;
}

export const DashboardNew: React.FC<DashboardNewProps> = ({ onOpenManageDataForSCurve }) => {
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [projectYearFilter, setProjectYearFilter] = useState<number | null>(null);
  const [sCurveData, setSCurveData] = useState<SCurveDataPoint[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingAllReport, setGeneratingAllReport] = useState(false);
  const [allReportProgress, setAllReportProgress] = useState('');
  const [showYearFilter, setShowYearFilter] = useState(false);
  const [downloadingChart, setDownloadingChart] = useState(false);
  const sCurveChartRef = useRef<HTMLDivElement | null>(null);

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
        const projectIds = projects
          .filter((project) => projectYearFilter ? new Date(project.startDate).getFullYear() === projectYearFilter : true)
          .map((project) => project.id);
        const data = await fetchAllProjectsSCurveData('monthly', projectIds);
        setSCurveData(data);
        return;
      }

      const data = await fetchSCurveData(selectedProjectId, 'monthly');
      setSCurveData(data);
    };

    loadSCurveData();
  }, [selectedProjectId, projectYearFilter, projects]);

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

  // Get selected project
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Filter projects by year
  const filteredProjects = useMemo(() => {
    if (!projectYearFilter) return projects;
    return projects.filter(
      (p) => new Date(p.startDate).getFullYear() === projectYearFilter
    );
  }, [projects, projectYearFilter]);

  // Auto-select first project when filter changes
  useEffect(() => {
    if (projectYearFilter === null) return;
    if (!selectedProjectId) return;
    const currentStillVisible = filteredProjects.some((p) => p.id === selectedProjectId);
    if (!currentStillVisible) {
      setSelectedProjectId(filteredProjects.length > 0 ? filteredProjects[0].id : null);
    }
  }, [filteredProjects, projectYearFilter, selectedProjectId]);

  // Get available years from S-Curve data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    sCurveData.forEach(d => years.add(d.year));
    return Array.from(years).sort();
  }, [sCurveData]);

  useEffect(() => {
    if (selectedYear && availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(null);
    }
  }, [availableYears, selectedYear]);

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

  // Available years for report filtering
  const reportYears = useMemo(() => {
    const years = projects
      .map(p => p.startDate ? new Date(p.startDate).getFullYear() : null)
      .filter((y): y is number => y !== null);
    return [...new Set(years)].sort((a, b) => b - a);
  }, [projects]);

  // Handle all projects report generation
  const handleGenerateAllReport = async (year?: number | null) => {
    setShowYearFilter(false);
    setGeneratingAllReport(true);
    setAllReportProgress('Memulai...');
    try {
      await generateAllProjectsReport((msg) => setAllReportProgress(msg), year);
      alert('All Report Project berhasil di-generate!');
    } catch (error: any) {
      console.error('Error generating all report:', error);
      alert(error?.message || 'Gagal generate report. Silakan coba lagi.');
    } finally {
      setGeneratingAllReport(false);
      setAllReportProgress('');
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

  const sanitizeFileNamePart = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusLabel = (status?: Project['status']) => {
    switch (status) {
      case 'active':
        return 'Aktif';
      case 'completed':
        return 'Selesai';
      case 'on-hold':
        return 'Ditunda';
      case 'cancelled':
        return 'Dibatalkan';
      default:
        return status || '-';
    }
  };

  const mobileMetricCards = selectedProject && displayMetrics
    ? [
        {
          label: 'Actual',
          value: `${displayMetrics.overallProgress.toFixed(1)}%`,
          detail: `${displayMetrics.variance >= 0 ? '+' : ''}${displayMetrics.variance.toFixed(1)}% vs plan`,
          tone: 'text-blue-700',
        },
        {
          label: 'Plan',
          value: `${displayMetrics.plannedProgress.toFixed(1)}%`,
          detail: 'Target saat ini',
          tone: 'text-amber-700',
        },
        {
          label: 'Aktivitas',
          value: `${displayMetrics.completedActivities}/${displayMetrics.totalActivities}`,
          detail: `${displayMetrics.completionRate.toFixed(0)}% selesai`,
          tone: 'text-emerald-700',
        },
        {
          label: 'Sisa',
          value: `${displayMetrics.daysRemaining}`,
          detail: 'hari',
          tone: 'text-purple-700',
        },
      ]
    : [];

  const handleDownloadChartPng = async () => {
    if (!chartData.length || !sCurveChartRef.current) return;

    setDownloadingChart(true);
    try {
      const canvas = await html2canvas(sCurveChartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const projectPart = selectedProject?.name ? sanitizeFileNamePart(selectedProject.name) : 'semua-project';
      const periodPart = 'bulanan';
      const yearPart = selectedYear ? `-${selectedYear}` : '';

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `diagram-s-curve-${projectPart}-${periodPart}${yearPart}.png`;
      link.click();
    } catch (error) {
      console.error('Error downloading S-Curve chart:', error);
      alert('Gagal mengunduh diagram S-Curve. Silakan coba lagi.');
    } finally {
      setDownloadingChart(false);
    }
  };

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
    <div className="min-h-screen bg-slate-50 p-3 pb-24 sm:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
        <div className="space-y-3 sm:hidden">
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 p-4 text-white shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">
                  {selectedProject ? selectedProject.category || 'Project' : 'Semua Project'}
                </p>
                <h1 className="mt-1 line-clamp-2 text-2xl font-bold leading-tight">
                  {selectedProject ? selectedProject.name : 'Semua Project'}
                </h1>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                {selectedProject ? getStatusLabel(selectedProject.status) : `${filteredProjects.length} project`}
              </span>
            </div>

            {selectedProject ? (
              <div className="mt-4 grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                  <User size={16} className="shrink-0 text-blue-100" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-100">PIC</p>
                    <p className="truncate text-sm font-bold">{selectedProject.pic || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                  <Calendar size={16} className="shrink-0 text-blue-100" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-100">Timeline</p>
                    <p className="truncate text-sm font-bold">
                      {formatDate(selectedProject.startDate)} - {formatDate(selectedProject.endDate)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm font-medium text-blue-100">
                Agregasi progress dari project aktif yang tersedia
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project
              </label>
              <select
                value={selectedProjectId ?? ''}
                onChange={(event) => setSelectedProjectId(event.target.value || null)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Semua Project</option>
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tahun Project
                </label>
                <select
                  value={projectYearFilter ?? ''}
                  onChange={(event) => setProjectYearFilter(event.target.value ? Number(event.target.value) : null)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Semua</option>
                  {reportYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  S-Curve
                </label>
                <select
                  value={selectedYear ?? ''}
                  onChange={(event) => setSelectedYear(event.target.value ? Number(event.target.value) : null)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Semua</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {mobileMetricCards.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {mobileMetricCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
                  <p className={`mt-1 text-xl font-bold ${card.tone}`}>{card.value}</p>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{card.detail}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">S-Curve</h2>
                <p className="text-xs font-medium text-slate-500">
                  {selectedProject ? selectedProject.name : 'Semua Project'}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <TrendingUp size={20} />
              </div>
            </div>

            {chartData.length > 0 ? (
              <SCurveChart
                data={chartData}
                showWeekly={false}
                yearLabel={selectedYear?.toString()}
              />
            ) : (
              <div className="flex min-h-[260px] items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                <div>
                  <p className="text-sm font-semibold text-slate-600">Data S-Curve belum tersedia</p>
                  {selectedProjectId && onOpenManageDataForSCurve && (
                    <button
                      type="button"
                      onClick={() => onOpenManageDataForSCurve(selectedProjectId)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <Database size={14} />
                      Isi S-Curve
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Project Header */}
        {selectedProject && (
          <div className="hidden sm:block">
            <ProjectHeader project={selectedProject} />
          </div>
        )}

        {/* Project Selector & Timeline */}
        <div className="hidden sm:grid sm:grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <ProjectSelector
              projects={projects}
              selectedProjectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
              yearFilter={projectYearFilter}
              onYearFilterChange={setProjectYearFilter}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Filter Tahun
            </label>
            <select
              value={selectedYear ?? ''}
              onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm hover:border-slate-400 transition-colors"
            >
              <option value="">Semua Tahun</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

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

            {/* Generate All Report Project Button */}
            <div className="relative mt-2">
              <button
                onClick={() => setShowYearFilter(!showYearFilter)}
                disabled={generatingAllReport}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-3 rounded-lg font-medium transition-all shadow-lg disabled:cursor-not-allowed"
              >
                {generatingAllReport ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span className="truncate">{allReportProgress || 'Generating...'}</span>
                  </>
                ) : (
                  <>
                    <BookOpen size={20} />
                    All Report Project
                    <ChevronDown size={16} className={`transition-transform ${showYearFilter ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              {/* Year Filter Dropdown */}
              {showYearFilter && !generatingAllReport && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <Filter size={12} />
                      Pilih Tahun Project
                    </p>
                  </div>
                  <div className="py-1 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => handleGenerateAllReport(null)}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center justify-between"
                    >
                      Semua Tahun
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{projects.length}</span>
                    </button>
                    {reportYears.map(year => {
                      const count = projects.filter(p => p.startDate && new Date(p.startDate).getFullYear() === year).length;
                      return (
                        <button
                          key={year}
                          onClick={() => handleGenerateAllReport(year)}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-between"
                        >
                          Tahun {year}
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Metrics */}
        {selectedProject && (
          <div className="hidden sm:block">
            <ProgressMetrics metrics={displayMetrics} />
          </div>
        )}

        {/* S-Curve Chart */}
        <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Diagram S-Curve {!selectedProjectId && `- Semua Project${projectYearFilter ? ` ${projectYearFilter}` : ''}`}
              </h2>
              <p className="text-slate-600">
                {selectedProjectId
                  ? 'Grafik perbandingan progress baseline (rencana) vs actual (realisasi)'
                  : projectYearFilter
                    ? `Grafik rata-rata progress project tahun ${projectYearFilter}`
                    : 'Grafik rata-rata progress dari semua project'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadChartPng}
              disabled={!chartData.length || downloadingChart}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${!chartData.length || downloadingChart
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
            >
              {downloadingChart ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {downloadingChart ? 'Mengunduh...' : 'Unduh PNG'}
            </button>
          </div>

          {chartData.length > 0 ? (
            <div ref={sCurveChartRef}>
              <SCurveChart
                data={chartData}
                showWeekly={false}
                yearLabel={selectedYear?.toString()}
              />
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
              <div className="text-center">
                <p className="text-slate-500 font-medium">
                  {selectedProjectId
                    ? `Project ${selectedProject?.name || 'ini'} belum memiliki data S-Curve bulanan`
                    : 'Belum ada data S-Curve bulanan untuk project yang tersedia'}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Isi baseline dan realisasi bulanan di halaman Manage Data
                </p>
                {selectedProjectId && onOpenManageDataForSCurve && (
                  <button
                    type="button"
                    onClick={() => onOpenManageDataForSCurve(selectedProjectId)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Database size={16} />
                    Isi S-Curve di Manage Data
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div >
    </div >
  );
};
