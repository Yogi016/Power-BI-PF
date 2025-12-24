import React, { useState, useEffect, useMemo } from 'react';
import { WorkProject, WorkDailyData, WorkMetrics } from '../types';
import { WorkSCurveChart } from '../components/WorkSCurveChart';
import { 
  fetchWorkProjects, 
  fetchWorkDailyData,
  createWorkProject,
  updateWorkProject,
  deleteWorkProject,
  upsertWorkDailyData
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
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
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
  
  // Daily data form
  const [dailyFormData, setDailyFormData] = useState({
    date: '',
    planCumulative: 0,
    actualCumulative: 0,
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
        
        // Load daily data for all projects
        const dailyMap: Record<string, WorkDailyData[]> = {};
        for (const project of projectsData) {
          const dailyData = await fetchWorkDailyData(project.id);
          dailyMap[project.id] = dailyData;
        }
        setDailyDataMap(dailyMap);
        
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

  const selectedDailyData = useMemo(() => 
    dailyDataMap[selectedProjectId] || [], 
    [dailyDataMap, selectedProjectId]
  );

  // Calculate metrics
  const metrics = useMemo((): WorkMetrics | null => {
    if (!selectedProject || selectedDailyData.length === 0) return null;

    const actualData = selectedDailyData.filter(d => d.actualCumulative > 0);
    const latestActual = actualData[actualData.length - 1];
    const latestPlan = selectedDailyData.find(d => d.dayIndex === latestActual?.dayIndex);
    
    const realTotalToday = latestActual?.actualCumulative || 0;
    const planToday = latestPlan?.planCumulative || 0;
    
    // Day of Work = Hari Berjalan (elapsed days from start date)
    const startDate = new Date(selectedProject.startDate);
    const today = new Date();
    const dayOfWork = Math.max(1, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    const endDate = new Date(selectedProject.endDate);
    const sisaHariKerja = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    
    const planPercentage = planToday > 0 ? (planToday / selectedProject.target) * 100 : 0;
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
          showNotification('success', 'Project berhasil diupdate');
          await loadData();
          setShowProjectForm(false);
        } else {
          showNotification('error', 'Gagal mengupdate project');
        }
      } else {
        const newProject = await createWorkProject(projectFormData as Omit<WorkProject, 'id' | 'createdAt' | 'updatedAt'>);
        if (newProject) {
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
      date: new Date().toISOString().split('T')[0],
      planCumulative: 0,
      actualCumulative: 0,
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

    const dateObj = new Date(dailyFormData.date);
    const dayIndex = dateObj.getDate();

    const success = await upsertWorkDailyData({
      workProjectId: selectedProject.id,
      date: dailyFormData.date,
      dayIndex,
      planCumulative: dailyFormData.planCumulative,
      actualCumulative: dailyFormData.actualCumulative,
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
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={48} className="animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-emerald-600 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">
              PROJECT {selectedProject?.projectName?.toUpperCase() || 'WORK'}
            </h1>
            {useDemo && (
              <span className="bg-yellow-500 text-yellow-900 text-xs px-2 py-1 rounded">
                Demo Mode - Jalankan SQL migration untuk data real
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateProject}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-emerald-700 px-4 py-2 rounded-lg font-medium transition-colors shadow-lg"
            >
              <Plus size={20} />
              Tambah Project
            </button>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-4 ${
            notification.type === 'success' 
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4">
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
                      setDailyFormData({ 
                        ...dailyFormData, 
                        date: e.target.value,
                        planCumulative: existingData?.planCumulative || 0,
                        actualCumulative: existingData?.actualCumulative || 0
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Plan Kumulatif</label>
                  <input
                    type="number"
                    value={dailyFormData.planCumulative}
                    onChange={(e) => setDailyFormData({ ...dailyFormData, planCumulative: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Realisasi Kumulatif</label>
                  <input
                    type="number"
                    value={dailyFormData.actualCumulative}
                    onChange={(e) => setDailyFormData({ ...dailyFormData, actualCumulative: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="0"
                  />
                </div>
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
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {projects.map(project => {
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
                className={`text-center transition-all px-4 py-2 rounded-lg ${
                  selectedProjectId === project.id 
                    ? 'bg-white bg-opacity-20 text-white' 
                    : 'text-emerald-200 hover:text-white hover:bg-white hover:bg-opacity-10'
                }`}
              >
                <div className="text-lg font-bold">
                  {project.faseName} ({realisasiPct.toFixed(1)}%)
                </div>
                <div className="text-sm">
                  Target: {project.target.toLocaleString('id-ID')}
                </div>
              </button>
            );
          })}
        </div>

        {selectedProject && (
          <>
            {/* Project Actions - Always visible when project selected */}
            <div className="flex justify-end gap-2 mb-4">
              <button
                onClick={() => handleEditProject(selectedProject)}
                className="flex items-center gap-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Edit2 size={16} />
                Edit Project
              </button>
              <button
                onClick={handleOpenDailyDataForm}
                className="flex items-center gap-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Input Data Harian
              </button>
              <button
                onClick={() => setDeleteConfirm({ id: selectedProject.id, name: `${selectedProject.projectName} - ${selectedProject.faseName}` })}
                className="flex items-center gap-2 bg-red-500 bg-opacity-80 hover:bg-opacity-100 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 size={16} />
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
                      <span className="font-semibold">{metrics.averagePenanamanPerDay.toLocaleString('id-ID', {maximumFractionDigits: 0})} bibit/day</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">PROGNOSA penanaman/day</span>
                      <span className="font-semibold">{metrics.prognosaPenanamanPerDay.toLocaleString('id-ID', {maximumFractionDigits: 0})} bibit/day</span>
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
                      <div className="text-sm text-slate-600">Real Total Today</div>
                      <div className="text-lg font-bold text-blue-600">
                        {metrics.realTotalToday.toLocaleString('id-ID')} pohon
                      </div>
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
            <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-slate-600 font-medium">Target Project Completion:</span>
                  <span className="ml-2 font-bold">
                    {new Date(selectedProject.endDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 font-medium">Obstacle:</span>
                  <span className="ml-2">{selectedProject.obstacle || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-600 font-medium">Action Plan:</span>
                  <span className="ml-2 text-sm">{selectedProject.actionPlan || '-'}</span>
                </div>
              </div>
            </div>

            {/* S-Curve Chart */}
            {selectedDailyData.length > 0 && (
              <WorkSCurveChart 
                data={selectedDailyData}
                title={`${selectedProject.projectName} ${selectedProject.faseName}`}
                target={selectedProject.target}
              />
            )}
          </>
        )}

        {/* Empty State */}
        {projects.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Belum Ada Data Work</h3>
            <p className="text-slate-600 mb-6">
              Mulai dengan menambahkan data proyek penanaman
            </p>
            <button
              onClick={handleCreateProject}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Plus size={20} />
              Tambah Project Work
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
