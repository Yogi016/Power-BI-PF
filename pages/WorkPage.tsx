import React, { useState, useEffect, useMemo } from 'react';
import { WorkProject, WorkDailyData, WorkMetrics, WorkPlanSchedule } from '../types';
import { WorkSCurveChart } from '../components/WorkSCurveChart';
import {
  fetchWorkProjects,
  fetchWorkDailyData,
  createWorkProject,
  updateWorkProject,
  deleteWorkProject,
  upsertWorkDailyData,
  fetchWorkPlanSchedule,
  batchUpsertWorkPlanSchedule
} from '../lib/supabase';
import {
  Plus,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Target,
  Users,
  TrendingUp,
  Calendar,
  Trash2,
  Edit2
} from 'lucide-react';

// Demo data for fallback when Supabase is not connected
const generateDemoData = (): { project: WorkProject; dailyData: WorkDailyData[] } => {
  const project: WorkProject = {
    id: 'demo-1',
    projectName: 'Mahakam',
    faseName: 'Fase 1',
    target: 77000,
    startDate: '2024-12-01',
    endDate: '2024-12-31',
    manpowerEksisting: 80,
    productivityTarget: 193,
    obstacle: '',
    actionPlan: 'Maintain Progress yang telah dilakukan agar bisa selesai tepat waktu atau lebih awal',
  };

  const dailyData: WorkDailyData[] = [];
  const totalDays = 24;

  for (let day = 1; day <= totalDays; day++) {
    const t = day / totalDays;
    const sCurve = 1 / (1 + Math.exp(-10 * (t - 0.3)));
    const planCumulative = Math.round(project.target * sCurve);

    const actualDay = 7;
    let actualCumulative = 0;
    if (day <= actualDay) {
      actualCumulative = Math.min(project.target, Math.round(planCumulative * 1.1));
    }

    dailyData.push({
      id: `day-${day}`,
      workProjectId: project.id,
      date: `2024-12-${day.toString().padStart(2, '0')}`,
      dayIndex: day,
      planCumulative,
      actualCumulative,
    });
  }

  return { project, dailyData };
};

const generateDemoData2 = (): { project: WorkProject; dailyData: WorkDailyData[] } => {
  const project: WorkProject = {
    id: 'demo-2',
    projectName: 'Mahakam',
    faseName: 'Fase 3',
    target: 372000,
    startDate: '2024-12-08',
    endDate: '2024-12-31',
    manpowerEksisting: 80,
    productivityTarget: 200,
    obstacle: '',
    actionPlan: 'Maintain progress penanaman agar dapat menyelesaikan project tepat waktu',
  };

  const dailyData: WorkDailyData[] = [];
  const startDay = 8;
  const endDay = 31;
  const totalDays = endDay - startDay + 1;

  for (let day = startDay; day <= endDay; day++) {
    const dayOffset = day - startDay;
    const t = dayOffset / totalDays;
    const sCurve = 1 / (1 + Math.exp(-8 * (t - 0.4)));
    const planCumulative = Math.round(project.target * sCurve);

    const actualDay = 16;
    let actualCumulative = 0;
    if (day <= actualDay) {
      actualCumulative = Math.round(planCumulative * 0.95);
    }

    dailyData.push({
      id: `day-${day}`,
      workProjectId: project.id,
      date: `2024-12-${day.toString().padStart(2, '0')}`,
      dayIndex: day,
      planCumulative,
      actualCumulative,
    });
  }

  return { project, dailyData };
};

export const WorkPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Projects and data
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [dailyDataMap, setDailyDataMap] = useState<Record<string, WorkDailyData[]>>({});
  const [planScheduleMap, setPlanScheduleMap] = useState<Record<string, WorkPlanSchedule[]>>({}); // Plan schedule per project
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [useDemo, setUseDemo] = useState(false);

  // Form states
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showDailyDataForm, setShowDailyDataForm] = useState(false);
  const [editingProject, setEditingProject] = useState<WorkProject | null>(null);
  const [projectFormData, setProjectFormData] = useState<Partial<WorkProject>>({
    projectName: '',
    faseName: '',
    target: 0,
    startDate: '',
    endDate: '',
    manpowerEksisting: 0,
    productivityTarget: 0,
    obstacle: '',
    actionPlan: '',
  });

  // Plan schedule for form
  const [formPlanSchedule, setFormPlanSchedule] = useState<WorkPlanSchedule[]>([]);

  // Daily data form - simplified: only input daily planting
  const [dailyFormData, setDailyFormData] = useState({
    date: '',
    dayIndex: 0,
    dailyPlanting: 0, // User inputs daily planting, cumulative auto-calculated
  });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Load data from Supabase
  const loadData = async () => {
    setLoading(true);
    try {
      const projectsData = await fetchWorkProjects();

      if (projectsData.length > 0) {
        setProjects(projectsData);
        setUseDemo(false);

        // Load daily data and plan schedule for all projects
        const dailyMap: Record<string, WorkDailyData[]> = {};
        const scheduleMap: Record<string, WorkPlanSchedule[]> = {};

        for (const project of projectsData) {
          const dailyData = await fetchWorkDailyData(project.id);
          dailyMap[project.id] = dailyData;

          const schedule = await fetchWorkPlanSchedule(project.id);
          scheduleMap[project.id] = schedule;
        }
        setDailyDataMap(dailyMap);
        setPlanScheduleMap(scheduleMap);

        if (!selectedProjectId || !projectsData.find(p => p.id === selectedProjectId)) {
          setSelectedProjectId(projectsData[0].id);
        }
      } else {
        // Use demo data if no data in Supabase
        const demo1 = generateDemoData();
        const demo2 = generateDemoData2();

        setProjects([demo1.project, demo2.project]);
        setDailyDataMap({
          [demo1.project.id]: demo1.dailyData,
          [demo2.project.id]: demo2.dailyData,
        });
        setSelectedProjectId(demo1.project.id);
        setUseDemo(true);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Fallback to demo
      const demo1 = generateDemoData();
      const demo2 = generateDemoData2();
      setProjects([demo1.project, demo2.project]);
      setDailyDataMap({
        [demo1.project.id]: demo1.dailyData,
        [demo2.project.id]: demo2.dailyData,
      });
      setSelectedProjectId(demo1.project.id);
      setUseDemo(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedProject = useMemo(() =>
    projects.find(p => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  // Extract unique years from all projects' startDate for the filter
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    projects.forEach(p => {
      if (p.startDate) years.add(new Date(p.startDate).getFullYear());
      if (p.endDate) years.add(new Date(p.endDate).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a); // newest first
  }, [projects]);

  // Filter projects by selected year
  const filteredProjects = useMemo(() => {
    if (!selectedYear) return projects;
    return projects.filter(p => {
      const startYear = p.startDate ? new Date(p.startDate).getFullYear() : null;
      const endYear = p.endDate ? new Date(p.endDate).getFullYear() : null;
      return startYear === selectedYear || endYear === selectedYear;
    });
  }, [projects, selectedYear]);

  // If the selected project is no longer in filteredProjects, auto-select the first one
  useEffect(() => {
    if (filteredProjects.length > 0 && !filteredProjects.find(p => p.id === selectedProjectId)) {
      setSelectedProjectId(filteredProjects[0].id);
    }
  }, [filteredProjects, selectedProjectId]);

  const selectedDailyData = useMemo(() =>
    dailyDataMap[selectedProjectId] || [],
    [dailyDataMap, selectedProjectId]
  );

  // Get plan schedule for selected project
  const selectedPlanSchedule = useMemo(() =>
    planScheduleMap[selectedProjectId] || [],
    [planScheduleMap, selectedProjectId]
  );

  // Calculate metrics
  const metrics = useMemo((): WorkMetrics | null => {
    if (!selectedProject || selectedDailyData.length === 0) return null;

    const actualData = selectedDailyData.filter(d => d.actualCumulative > 0);
    const latestActual = actualData[actualData.length - 1];

    const realTotalToday = latestActual?.actualCumulative || 0;

    // Day of Work = Hari Berjalan (elapsed days from start date)
    const startDate = new Date(selectedProject.startDate);
    const today = new Date();
    const dayOfWork = Math.max(1, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const endDate = new Date(selectedProject.endDate);
    const sisaHariKerja = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    // Plan % = 100% if planSchedule covers the full target (schedule is complete)
    const lastPlanDay = selectedPlanSchedule.length > 0
      ? selectedPlanSchedule[selectedPlanSchedule.length - 1]
      : null;
    const planPercentage = lastPlanDay && lastPlanDay.planCumulative >= selectedProject.target
      ? 100
      : (lastPlanDay?.planCumulative || 0) / selectedProject.target * 100;
    const realisasiPercentage = (realTotalToday / selectedProject.target) * 100;

    const averagePenanamanPerDay = dayOfWork > 0 ? realTotalToday / dayOfWork : 0;
    const sisaTarget = selectedProject.target - realTotalToday;
    const prognosaPenanamanPerDay = sisaHariKerja > 0 ? sisaTarget / sisaHariKerja : 0;

    const averageProductivity = selectedProject.manpowerEksisting > 0
      ? averagePenanamanPerDay / selectedProject.manpowerEksisting
      : 0;

    const prognosManpower = selectedProject.productivityTarget > 0
      ? Math.ceil(prognosaPenanamanPerDay / selectedProject.productivityTarget)
      : 0;

    const tambahanManpower = Math.max(0, prognosManpower - selectedProject.manpowerEksisting);

    return {
      planPercentage,
      realisasiPercentage,
      dayOfWork,
      sisaHariKerja,
      realTotalToday,
      averagePenanamanPerDay,
      prognosaPenanamanPerDay,
      averageProductivity,
      prognosManpower,
      tambahanManpower,
    };
  }, [selectedProject, selectedDailyData]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Helper: Generate plan schedule from start/end dates and target
  const generatePlanSchedule = (startDate: string, endDate: string, target: number, projectId: string = ''): WorkPlanSchedule[] => {
    if (!startDate || !endDate || target <= 0) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (totalDays <= 0) return [];

    const schedule: WorkPlanSchedule[] = [];
    const dailyTarget = Math.floor(target / totalDays);
    const remainder = target - (dailyTarget * totalDays);

    let cumulative = 0;
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);

      // Add remainder to first day
      const dayTarget = i === 0 ? dailyTarget + remainder : dailyTarget;
      cumulative += dayTarget;
      const weight = parseFloat(((dayTarget / target) * 100).toFixed(2));

      schedule.push({
        workProjectId: projectId,
        dayIndex: i + 1,
        date: currentDate.toISOString().split('T')[0],
        dailyTarget: dayTarget,
        weight: weight,
        planCumulative: cumulative,
      });
    }

    return schedule;
  };

  // CRUD Handlers
  const handleCreateProject = () => {
    setEditingProject(null);
    setProjectFormData({
      projectName: '',
      faseName: '',
      target: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      manpowerEksisting: 0,
      productivityTarget: 0,
      obstacle: '',
      actionPlan: '',
    });
    setFormPlanSchedule([]);
    setShowProjectForm(true);
  };

  const handleEditProject = (project: WorkProject) => {
    setEditingProject(project);
    setProjectFormData({
      projectName: project.projectName,
      faseName: project.faseName,
      target: project.target,
      startDate: project.startDate,
      endDate: project.endDate,
      manpowerEksisting: project.manpowerEksisting,
      productivityTarget: project.productivityTarget,
      obstacle: project.obstacle || '',
      actionPlan: project.actionPlan || '',
    });
    setShowProjectForm(true);
  };

  const handleSaveProject = async () => {
    if (!projectFormData.projectName || !projectFormData.faseName || !projectFormData.target) {
      showNotification('error', 'Nama project, fase, dan target wajib diisi');
      return;
    }

    if (useDemo) {
      showNotification('error', 'Tidak dapat menyimpan - Supabase belum terhubung. Jalankan SQL migration terlebih dahulu.');
      return;
    }

    try {
      if (editingProject) {
        const success = await updateWorkProject(editingProject.id, projectFormData as WorkProject);
        if (success) {
          // Save plan schedule
          if (formPlanSchedule.length > 0) {
            const scheduleWithProjectId = formPlanSchedule.map(s => ({
              ...s,
              workProjectId: editingProject.id,
            }));
            await batchUpsertWorkPlanSchedule(scheduleWithProjectId);
          }
          showNotification('success', 'Project berhasil diupdate');
          await loadData();
          setShowProjectForm(false);
        } else {
          showNotification('error', 'Gagal mengupdate project');
        }
      } else {
        const newProject = await createWorkProject(projectFormData as Omit<WorkProject, 'id' | 'createdAt' | 'updatedAt'>);
        if (newProject) {
          // Save plan schedule
          if (formPlanSchedule.length > 0) {
            const scheduleWithProjectId = formPlanSchedule.map(s => ({
              ...s,
              workProjectId: newProject.id,
            }));
            await batchUpsertWorkPlanSchedule(scheduleWithProjectId);
          }
          showNotification('success', 'Project berhasil dibuat');
          await loadData();
          setSelectedProjectId(newProject.id);
          setShowProjectForm(false);
        } else {
          showNotification('error', 'Gagal membuat project');
        }
      }
    } catch (error) {
      showNotification('error', 'Terjadi kesalahan');
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirm) return;

    if (useDemo) {
      showNotification('error', 'Tidak dapat menghapus - Supabase belum terhubung');
      setDeleteConfirm(null);
      return;
    }

    const success = await deleteWorkProject(deleteConfirm.id);
    if (success) {
      showNotification('success', 'Project berhasil dihapus');
      await loadData();
    } else {
      showNotification('error', 'Gagal menghapus project');
    }
    setDeleteConfirm(null);
  };

  const handleOpenDailyDataForm = () => {
    if (!selectedProject) return;
    setDailyFormData({
      date: '',
      dayIndex: 0,
      dailyPlanting: 0,
    });
    setShowDailyDataForm(true);
  };

  const handleSaveDailyData = async () => {
    if (!selectedProject || !dailyFormData.date) {
      showNotification('error', 'Tanggal wajib diisi');
      return;
    }

    if (useDemo) {
      showNotification('error', 'Tidak dapat menyimpan - Supabase belum terhubung');
      return;
    }

    const dayIndex = dailyFormData.dayIndex;

    // Get plan cumulative from plan schedule
    const planSchedule = planScheduleMap[selectedProject.id] || [];
    const planForDay = planSchedule.find(p => p.dayIndex === dayIndex);
    const planCumulative = planForDay?.planCumulative || 0;

    // Calculate actual cumulative from previous days + today's daily planting
    const sortedData = [...selectedDailyData].sort((a, b) => a.dayIndex - b.dayIndex);
    const previousDays = sortedData.filter(d => d.dayIndex < dayIndex);
    const previousCumulative = previousDays.length > 0
      ? previousDays[previousDays.length - 1].actualCumulative
      : 0;

    const actualCumulative = previousCumulative + dailyFormData.dailyPlanting;

    const success = await upsertWorkDailyData({
      workProjectId: selectedProject.id,
      date: dailyFormData.date,
      dayIndex,
      planCumulative: planCumulative,
      actualCumulative: actualCumulative,
    });

    if (success) {
      showNotification('success', 'Data harian berhasil disimpan');
      await loadData();
      setShowDailyDataForm(false);
    } else {
      showNotification('error', 'Gagal menyimpan data harian');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          <p className="text-sm text-slate-500 font-medium">Memuat data Work...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-6">
      <div>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2 sm:gap-3">
              <span className="p-1.5 sm:p-2 bg-slate-100 rounded-lg">
                <Target size={20} className="text-emerald-600 sm:hidden" />
                <Target size={24} className="text-emerald-600 hidden sm:block" />
              </span>
              <span className="truncate">PROJECT {selectedProject?.projectName?.toUpperCase() || 'WORK'}</span>
            </h1>
            {useDemo && (
              <span className="mt-2 inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md border border-amber-200">
                <AlertCircle size={12} />
                Demo Mode - Jalankan SQL migration untuk data real
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {availableYears.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm h-9 group transition-colors focus-within:ring-1 focus-within:ring-slate-950">
                <Calendar size={14} className="text-slate-500 group-hover:text-slate-900 transition-colors" />
                <select
                  value={selectedYear ?? ''}
                  onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                  className="outline-none text-sm bg-transparent appearance-none cursor-pointer pr-4"
                >
                  <option value="">Semua Tahun</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={handleCreateProject}
              className="group flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 sm:px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform" />
              <span className="hidden sm:inline">Tambah Project</span>
            </button>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-4 ${notification.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
            {notification.type === 'success' ? (
              <CheckCircle2 size={20} className="text-green-600" />
            ) : (
              <AlertCircle size={20} className="text-red-600" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
            <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl p-4 sm:p-6 max-w-md w-full sm:mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Konfirmasi Hapus</h3>
                  <p className="text-sm text-slate-600">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>

              <p className="text-slate-700 mb-6">
                Yakin ingin menghapus project <strong>"{deleteConfirm.name}"</strong>?
                Semua data harian terkait juga akan terhapus.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteProject}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Ya, Hapus
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project Form Modal */}
        {showProjectForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl p-4 sm:p-6 max-w-2xl w-full sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingProject ? 'Edit Project Work' : 'Tambah Project Work'}
                </h2>
                <button onClick={() => setShowProjectForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X size={20} className="text-slate-600" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama Project <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectFormData.projectName || ''}
                    onChange={(e) => setProjectFormData({ ...projectFormData, projectName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Mahakam"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama Fase <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectFormData.faseName || ''}
                    onChange={(e) => setProjectFormData({ ...projectFormData, faseName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Fase 1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Target Pohon <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={projectFormData.target || ''}
                    onChange={(e) => setProjectFormData({ ...projectFormData, target: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="77000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Manpower Eksisting</label>
                  <input
                    type="number"
                    value={projectFormData.manpowerEksisting || ''}
                    onChange={(e) => setProjectFormData({ ...projectFormData, manpowerEksisting: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="80"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={projectFormData.startDate || ''}
                    onChange={(e) => setProjectFormData({ ...projectFormData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={projectFormData.endDate || ''}
                    onChange={(e) => setProjectFormData({ ...projectFormData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Productivity Target (bibit/orang/day)</label>
                  <input
                    type="number"
                    value={projectFormData.productivityTarget || ''}
                    onChange={(e) => setProjectFormData({ ...projectFormData, productivityTarget: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="193"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Obstacle</label>
                  <textarea
                    value={projectFormData.obstacle || ''}
                    onChange={(e) => setProjectFormData({ ...projectFormData, obstacle: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    rows={2}
                    placeholder="Hambatan yang dihadapi..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Action Plan</label>
                  <textarea
                    value={projectFormData.actionPlan || ''}
                    onChange={(e) => setProjectFormData({ ...projectFormData, actionPlan: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    rows={2}
                    placeholder="Rencana tindakan..."
                  />
                </div>
              </div>

              {/* Plan Schedule Table Section */}
              <div className="mt-6 border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    📋 Rencana Harian
                    {formPlanSchedule.length > 0 && (
                      <span className="text-sm font-normal text-emerald-600">
                        (Total: {formPlanSchedule.reduce((sum, s) => sum + s.weight, 0).toFixed(1)}%)
                      </span>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (projectFormData.startDate && projectFormData.endDate && projectFormData.target) {
                        const schedule = generatePlanSchedule(
                          projectFormData.startDate,
                          projectFormData.endDate,
                          projectFormData.target
                        );
                        setFormPlanSchedule(schedule);
                      } else {
                        showNotification('error', 'Isi tanggal mulai, selesai, dan target pohon lebih dahulu');
                      }
                    }}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg"
                  >
                    Generate Rencana
                  </button>
                </div>

                {formPlanSchedule.length === 0 ? (
                  <div className="text-center text-slate-500 py-4 bg-slate-50 rounded-lg">
                    Klik "Generate Rencana" untuk membuat jadwal harian otomatis
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Hari</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Tanggal</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Target Harian</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Bobot</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Kumulatif</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formPlanSchedule.map((item, idx) => (
                          <tr key={idx} className="border-t hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-700">{item.dayIndex}</td>
                            <td className="px-3 py-2 text-slate-600">{item.date}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                value={item.dailyTarget}
                                onChange={(e) => {
                                  const newTarget = Number(e.target.value);
                                  const newSchedule = [...formPlanSchedule];
                                  newSchedule[idx].dailyTarget = newTarget;

                                  // Recalculate weight and cumulative for this and all following days
                                  const total = projectFormData.target || 1;
                                  let cumulative = 0;
                                  for (let i = 0; i < newSchedule.length; i++) {
                                    cumulative += newSchedule[i].dailyTarget;
                                    newSchedule[i].planCumulative = cumulative;
                                    newSchedule[i].weight = parseFloat(((newSchedule[i].dailyTarget / total) * 100).toFixed(2));
                                  }
                                  setFormPlanSchedule(newSchedule);
                                }}
                                className="w-24 px-2 py-1 border rounded text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">{item.weight.toFixed(1)}%</td>
                            <td className="px-3 py-2 text-right font-medium text-emerald-600">
                              {item.planCumulative.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveProject}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Save size={18} />
                  Simpan
                </button>
                <button
                  onClick={() => setShowProjectForm(false)}
                  className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <X size={18} />
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Daily Data Form Modal */}
        {showDailyDataForm && selectedProject && (() => {
          // Generate list of days from start to end date
          const startDate = new Date(selectedProject.startDate);
          const endDate = new Date(selectedProject.endDate);
          const daysList: { date: string; dayIndex: number; label: string; hasData: boolean }[] = [];

          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayIndex = currentDate.getDate();
            const existingData = selectedDailyData.find(d => d.date === dateStr);

            daysList.push({
              date: dateStr,
              dayIndex,
              label: `Hari ${dayIndex} - ${currentDate.toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })}${existingData ? ' ✓' : ''}`,
              hasData: !!existingData
            });

            currentDate.setDate(currentDate.getDate() + 1);
          }

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Input Data Harian</h2>
                  <button onClick={() => setShowDailyDataForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <X size={20} className="text-slate-600" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Pilih Hari <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={dailyFormData.date}
                      onChange={(e) => {
                        const selected = daysList.find(d => d.date === e.target.value);
                        const existingData = selectedDailyData.find(d => d.date === e.target.value);

                        // Calculate existing daily planting from cumulative difference
                        let existingDaily = 0;
                        if (existingData && selected) {
                          const sortedData = [...selectedDailyData].sort((a, b) => a.dayIndex - b.dayIndex);
                          const prevDay = sortedData.filter(d => d.dayIndex < selected.dayIndex).pop();
                          const prevCumulative = prevDay?.actualCumulative || 0;
                          existingDaily = Math.max(0, existingData.actualCumulative - prevCumulative);
                        }

                        setDailyFormData({
                          date: e.target.value,
                          dayIndex: selected?.dayIndex || 0,
                          dailyPlanting: existingDaily
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    >
                      <option value="">-- Pilih Hari --</option>
                      {daysList.map(day => (
                        <option key={day.date} value={day.date}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      ✓ = sudah ada data
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Penanaman Hari Ini <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={dailyFormData.dailyPlanting}
                      onChange={(e) => setDailyFormData({ ...dailyFormData, dailyPlanting: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Jumlah bibit ditanam hari ini"
                    />
                  </div>

                  {/* Preview of plan and cumulative */}
                  {dailyFormData.date && (
                    <div className="bg-slate-50 border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Plan Kumulatif:</span>
                        <span className="font-medium text-blue-600">
                          {(() => {
                            const planSchedule = planScheduleMap[selectedProject?.id || ''] || [];
                            const planForDay = planSchedule.find(p => p.dayIndex === dailyFormData.dayIndex);
                            return planForDay?.planCumulative?.toLocaleString('id-ID') || '0';
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Realisasi Kumulatif:</span>
                        <span className="font-bold text-emerald-600">
                          {(() => {
                            const sortedData = [...selectedDailyData].sort((a, b) => a.dayIndex - b.dayIndex);
                            const prevDay = sortedData.filter(d => d.dayIndex < dailyFormData.dayIndex).pop();
                            const prevCumulative = prevDay?.actualCumulative || 0;
                            return (prevCumulative + dailyFormData.dailyPlanting).toLocaleString('id-ID');
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSaveDailyData}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Save size={18} />
                    Simpan
                  </button>
                  <button
                    onClick={() => setShowDailyDataForm(false)}
                    className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <X size={18} />
                    Batal
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Fase Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 animate-in slide-in-from-left-4 duration-500 overflow-x-auto">
          {filteredProjects.length > 0 ? (
            filteredProjects.map(project => {
              // Calculate percentage for each project from their own daily data
              const projectDailyData = dailyDataMap[project.id] || [];
              const actualData = projectDailyData.filter(d => d.actualCumulative > 0);
              const latestActual = actualData[actualData.length - 1];
              const realTotal = latestActual?.actualCumulative || 0;
              const realisasiPct = project.target > 0 ? (realTotal / project.target) * 100 : 0;

              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`flex flex-col items-start px-4 py-3 rounded-xl border text-left transition-all min-w-[160px] ${selectedProjectId === project.id
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50'
                    }`}
                >
                  <div className="text-sm font-bold flex items-center justify-between w-full">
                    <span>{project.faseName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${selectedProjectId === project.id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                      {realisasiPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs mt-1 opacity-80">
                    Target: {project.target.toLocaleString('id-ID')}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-sm text-slate-500 italic py-2">
              Tidak ada project untuk tahun {selectedYear}. Coba pilih tahun lain.
            </div>
          )}
        </div>

        {selectedProject && (
          <>
            {/* Project Actions - Always visible when project selected */}
            <div className="flex justify-end gap-2 mb-4 animate-in fade-in duration-500">
              <button
                onClick={() => handleEditProject(selectedProject)}
                className="group flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
              >
                <Edit2 size={14} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
                Edit Project
              </button>
              <button
                onClick={handleOpenDailyDataForm}
                className="group flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
              >
                <Plus size={14} className="text-slate-500 group-hover:text-emerald-600 group-hover:rotate-90 transition-all" />
                Input Data Harian
              </button>
              <button
                onClick={() => setDeleteConfirm({ id: selectedProject.id, name: `${selectedProject.projectName} - ${selectedProject.faseName}` })}
                className="group flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <Trash2 size={14} className="text-red-500 group-hover:scale-110 transition-transform" />
                Hapus
              </button>
            </div>

            {/* No Data Message */}
            {!metrics && (
              <div className="bg-white rounded-xl shadow-lg p-8 mb-6 text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} className="text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Belum Ada Data Harian</h3>
                <p className="text-slate-600 mb-4">
                  Project <strong>{selectedProject.projectName} - {selectedProject.faseName}</strong> belum memiliki data harian.
                </p>
                <button
                  onClick={handleOpenDailyDataForm}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Plus size={18} />
                  Input Data Harian Pertama
                </button>
              </div>
            )}

            {/* Summary Cards - Only when metrics exist */}
            {metrics && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Left Card */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b">
                      <h3 className="font-bold text-slate-800">
                        {selectedProject.projectName} - {selectedProject.faseName}
                      </h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-sm text-slate-600">Plan</div>
                          <div className="text-xl font-bold text-blue-600">
                            {metrics.planPercentage.toFixed(1)}%
                          </div>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-lg">
                          <div className="text-sm text-slate-600">Realisasi</div>
                          <div className="text-xl font-bold text-orange-600">
                            {metrics.realisasiPercentage.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Day of Work</span>
                          <span className="font-bold">{metrics.dayOfWork} hari</span>
                        </div>
                      </div>

                      <div className="border-t pt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">AVERAGE penanaman/day</span>
                          <span className="font-semibold">{metrics.averagePenanamanPerDay.toLocaleString('id-ID', { maximumFractionDigits: 0 })} bibit/day</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">PROGNOSA penanaman/day</span>
                          <span className="font-semibold">{metrics.prognosaPenanamanPerDay.toLocaleString('id-ID', { maximumFractionDigits: 0 })} bibit/day</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Card */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50 p-3 rounded-lg">
                          <div className="text-sm text-slate-600">Target</div>
                          <div className="text-lg font-bold text-emerald-600">
                            {selectedProject.target.toLocaleString('id-ID')} pohon
                          </div>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-sm text-slate-600">Realisasi Kumulatif</div>
                          <div className="text-lg font-bold text-blue-600">
                            {metrics.realTotalToday.toLocaleString('id-ID')} pohon
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar for Realisasi */}
                      <div className="bg-slate-100 p-3 rounded-lg">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-600">Progress Realisasi</span>
                          <span className="font-bold text-emerald-600">{metrics.realisasiPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-3 rounded-full transition-all"
                            style={{ width: `${Math.min(100, metrics.realisasiPercentage)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                          <span>0</span>
                          <span>{selectedProject.target.toLocaleString('id-ID')}</span>
                        </div>
                      </div>

                      <div className="bg-amber-50 p-3 rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Sisa Hari Kerja</span>
                          <span className="font-bold text-amber-700">{metrics.sisaHariKerja} sisa hari kerja</span>
                        </div>
                      </div>

                      <div className="border-t pt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Average Productivity</span>
                          <span className="font-semibold">{metrics.averageProductivity.toFixed(0)} bibit/orang/day</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Manpower Eksisting</span>
                          <span className="font-semibold">{selectedProject.manpowerEksisting} orang</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Productivity Target</span>
                          <span className="font-semibold">{selectedProject.productivityTarget} bibit/orang/day</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Prognosa Manpower</span>
                          <span className="font-semibold">{metrics.prognosManpower} orang/day</span>
                        </div>
                        <div className="flex justify-between text-sm bg-red-50 p-2 rounded">
                          <span className="text-red-700 font-medium">Tambahan Manpower</span>
                          <span className="font-bold text-red-700">{metrics.tambahanManpower}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Project Completion Info */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 mb-6 animate-in slide-in-from-bottom-4 duration-500 delay-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <span className="block text-sm text-slate-500 font-medium">Target Project Completion</span>
                    <span className="block font-bold text-slate-900 mt-0.5">
                      {new Date(selectedProject.endDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <span className="block text-sm text-slate-500 font-medium">Obstacle</span>
                    <span className="block text-sm text-slate-700 mt-0.5 leading-snug">{selectedProject.obstacle || '-'}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg shrink-0">
                    <Target className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <span className="block text-sm text-slate-500 font-medium">Action Plan</span>
                    <span className="block text-sm text-slate-700 mt-0.5 leading-snug">{selectedProject.actionPlan || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* S-Curve Chart */}
            {selectedDailyData.length > 0 && (
              <WorkSCurveChart
                data={selectedDailyData}
                title={`${selectedProject.projectName} ${selectedProject.faseName}`}
                target={selectedProject.target}
                planSchedule={planScheduleMap[selectedProject.id] || []}
              />
            )}
          </>
        )}

        {/* Empty State */}
        {projects.length === 0 && !loading && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-12 text-center group">
            <div className="rounded-full bg-white border border-slate-200 shadow-sm p-4 mb-4 transition-transform group-hover:scale-105">
              <Target size={32} className="text-emerald-500 group-hover:text-emerald-600 transition-colors" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Belum Ada Data Work</h3>
            <p className="text-slate-500 mb-6 max-w-sm">
              Mulai pantau progress dengan menambahkan data proyek penanaman pertama Anda.
            </p>
            <button
              onClick={handleCreateProject}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-emerald-700"
            >
              <Plus size={16} />
              Tambah Project Work
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
