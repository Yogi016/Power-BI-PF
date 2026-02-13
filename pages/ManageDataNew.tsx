import React, { useState, useEffect } from 'react';
import { Project, SCurveDataPoint } from '../types';
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  fetchSCurveData,
  upsertSCurveBaseline,
  upsertSCurveActual,
  createActivity,
} from '../lib/supabase';
import { supabase } from '../lib/supabaseClient';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  TrendingUp,
} from 'lucide-react';

interface ManageDataNewProps {
  focusProjectId?: string | null;
  onFocusHandled?: () => void;
}

interface ActivityFormRow {
  code: string;
  activityName: string;
  weight: number;
  evidence: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface MonthlySCurveEditorRow {
  monthIndex: number;
  monthLabel: string;
  cumulativeBaseline: number;
  cumulativeActual: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const CURRENT_YEAR = new Date().getFullYear();

const createEmptySCurveRows = (): MonthlySCurveEditorRow[] => {
  return MONTHS.map((monthLabel, idx) => ({
    monthIndex: idx + 1,
    monthLabel,
    cumulativeBaseline: 0,
    cumulativeActual: 0,
  }));
};

const mapSCurveDataToRows = (data: SCurveDataPoint[], year: number): MonthlySCurveEditorRow[] => {
  const byMonth = new Map<number, SCurveDataPoint>();

  data
    .filter((d) => d.year === year)
    .forEach((d) => {
      byMonth.set(d.periodIndex, d);
    });

  return MONTHS.map((monthLabel, idx) => {
    const monthIndex = idx + 1;
    const monthData = byMonth.get(monthIndex);

    return {
      monthIndex,
      monthLabel,
      cumulativeBaseline: Number(monthData?.baseline) || 0,
      cumulativeActual: Number(monthData?.actual) || 0,
    };
  });
};

export const ManageDataNew: React.FC<ManageDataNewProps> = ({
  focusProjectId = null,
  onFocusHandled,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSCurve, setLoadingSCurve] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ projectId: string; projectName: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    pic: '',
    description: '',
    category: '',
    location: '',
    startDate: '',
    endDate: '',
    status: 'active',
    budget: undefined,
  });

  // Activities state for the project being created/edited
  const [activities, setActivities] = useState<ActivityFormRow[]>([]);

  // S-Curve editor state
  const [sCurveSourceData, setSCurveSourceData] = useState<SCurveDataPoint[]>([]);
  const [selectedSCurveYear, setSelectedSCurveYear] = useState<number>(CURRENT_YEAR);
  const [availableSCurveYears, setAvailableSCurveYears] = useState<number[]>([CURRENT_YEAR]);
  const [sCurveRows, setSCurveRows] = useState<MonthlySCurveEditorRow[]>(createEmptySCurveRows);

  // Load projects
  useEffect(() => {
    loadProjects();
  }, []);

  // Open edit mode automatically when redirected from dashboard no-data CTA
  useEffect(() => {
    if (!focusProjectId || projects.length === 0) return;

    const targetProject = projects.find((p) => p.id === focusProjectId);
    if (!targetProject) {
      onFocusHandled?.();
      return;
    }

    void handleEdit(targetProject).finally(() => {
      onFocusHandled?.();
    });
  }, [focusProjectId, projects]);

  const loadProjects = async () => {
    setLoading(true);
    const data = await fetchProjects();
    setProjects(data);
    setLoading(false);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const resetSCurveEditor = (year = CURRENT_YEAR) => {
    setSCurveSourceData([]);
    setSelectedSCurveYear(year);
    setAvailableSCurveYears([year]);
    setSCurveRows(createEmptySCurveRows());
  };

  const applySCurveDataToEditor = (data: SCurveDataPoint[], preferredYear?: number) => {
    const years = Array.from(new Set(data.map((d) => d.year))).sort((a, b) => a - b);
    const targetYear = preferredYear ?? (years.length > 0 ? years[years.length - 1] : CURRENT_YEAR);
    const allYears = Array.from(new Set([...years, CURRENT_YEAR, targetYear])).sort((a, b) => a - b);

    setSCurveSourceData(data);
    setAvailableSCurveYears(allYears);
    setSelectedSCurveYear(targetYear);
    setSCurveRows(mapSCurveDataToRows(data, targetYear));
  };

  const loadActivitiesForProject = async (projectId: string): Promise<ActivityFormRow[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('activities')
      .select('code, activity_name, weight, evidence, start_date, end_date, status')
      .eq('project_id', projectId)
      .order('code', { ascending: true });

    if (error) throw error;

    return (data || []).map((a) => ({
      code: a.code,
      activityName: a.activity_name,
      weight: a.weight || 0,
      evidence: a.evidence || '',
      startDate: a.start_date || '',
      endDate: a.end_date || '',
      status: a.status || 'not-started',
    }));
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingProject(null);
    setFormData({
      name: '',
      pic: '',
      description: '',
      category: 'Environmental',
      location: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      status: 'active',
      budget: undefined,
    });
    setActivities([]);
    resetSCurveEditor(CURRENT_YEAR);
    setLoadingSCurve(false);
  };

  const handleEdit = async (project: Project) => {
    setIsCreating(false);
    setEditingProject(project);
    setFormData(project);
    setLoadingSCurve(true);

    try {
      const [projectActivities, projectSCurve] = await Promise.all([
        loadActivitiesForProject(project.id),
        fetchSCurveData(project.id, 'monthly'),
      ]);

      setActivities(projectActivities);
      applySCurveDataToEditor(projectSCurve);
    } catch (error) {
      console.error('Error loading project detail:', error);
      setActivities([]);
      resetSCurveEditor(CURRENT_YEAR);
      showNotification('error', 'Gagal memuat activities atau data S-Curve project');
    } finally {
      setLoadingSCurve(false);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingProject(null);
    setFormData({});
    setActivities([]);
    resetSCurveEditor(CURRENT_YEAR);
    setLoadingSCurve(false);
  };

  const handleSCurveYearChange = (year: number) => {
    setSelectedSCurveYear(year);

    if (sCurveSourceData.length > 0) {
      setSCurveRows(mapSCurveDataToRows(sCurveSourceData, year));
      return;
    }

    setSCurveRows(createEmptySCurveRows());
  };

  const updateSCurveValue = (
    monthIndex: number,
    field: 'cumulativeBaseline' | 'cumulativeActual',
    value: string
  ) => {
    const parsedValue = Number.parseFloat(value);
    const numericValue = Number.isFinite(parsedValue) ? parsedValue : 0;

    setSCurveRows((prev) =>
      prev.map((row) =>
        row.monthIndex === monthIndex
          ? {
              ...row,
              [field]: numericValue,
            }
          : row
      )
    );
  };

  const validateSCurveRows = (): string | null => {
    if (sCurveRows.length === 0) {
      return 'Data S-Curve bulanan tidak tersedia';
    }

    let hasNonZero = false;
    let previousBaseline = 0;
    let previousActual = 0;

    for (const row of sCurveRows) {
      const baseline = row.cumulativeBaseline;
      const actual = row.cumulativeActual;

      if (!Number.isFinite(baseline) || baseline < 0 || baseline > 100) {
        return `Baseline bulan ${row.monthLabel} harus di antara 0 sampai 100`;
      }

      if (!Number.isFinite(actual) || actual < 0 || actual > 100) {
        return `Realisasi bulan ${row.monthLabel} harus di antara 0 sampai 100`;
      }

      if (baseline < previousBaseline) {
        return `Baseline kumulatif bulan ${row.monthLabel} tidak boleh lebih kecil dari bulan sebelumnya`;
      }

      if (actual < previousActual) {
        return `Realisasi kumulatif bulan ${row.monthLabel} tidak boleh lebih kecil dari bulan sebelumnya`;
      }

      if (baseline > 0 || actual > 0) {
        hasNonZero = true;
      }

      previousBaseline = baseline;
      previousActual = actual;
    }

    if (!hasNonZero) {
      return 'Minimal satu nilai baseline atau realisasi harus lebih dari 0';
    }

    return null;
  };

  const saveSCurveForProject = async (projectId: string): Promise<boolean> => {
    const validationError = validateSCurveRows();
    if (validationError) {
      showNotification('error', validationError);
      return false;
    }

    let previousBaseline = 0;
    const baselinePayload = sCurveRows.map((row) => {
      const cumulativeBaseline = Number(row.cumulativeBaseline.toFixed(2));
      const periodBaseline = Number((cumulativeBaseline - previousBaseline).toFixed(2));
      previousBaseline = cumulativeBaseline;

      return {
        periodLabel: row.monthLabel,
        periodIndex: row.monthIndex,
        year: selectedSCurveYear,
        cumulativeBaseline,
        periodBaseline,
      };
    });

    let previousActual = 0;
    const actualPayload = sCurveRows.map((row) => {
      const cumulativeActual = Number(row.cumulativeActual.toFixed(2));
      const periodActual = Number((cumulativeActual - previousActual).toFixed(2));
      previousActual = cumulativeActual;

      return {
        periodLabel: row.monthLabel,
        periodIndex: row.monthIndex,
        year: selectedSCurveYear,
        cumulativeActual,
        periodActual,
      };
    });

    const baselineSaved = await upsertSCurveBaseline(projectId, 'monthly', baselinePayload);
    if (!baselineSaved) {
      showNotification('error', 'Gagal menyimpan data baseline S-Curve');
      return false;
    }

    const actualSaved = await upsertSCurveActual(projectId, 'monthly', actualPayload);
    if (!actualSaved) {
      showNotification('error', 'Gagal menyimpan data realisasi S-Curve');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!formData.name || !formData.pic || !formData.startDate || !formData.endDate) {
      showNotification('error', 'Nama, PIC, dan tanggal wajib diisi');
      return;
    }

    // Validate activities total weight
    const totalWeight = activities.reduce((sum, a) => sum + a.weight, 0);
    if (activities.length > 0 && Math.abs(totalWeight - 100) > 0.1) {
      showNotification('error', `Total bobot activities harus 100% (saat ini: ${totalWeight.toFixed(1)}%)`);
      return;
    }

    if (isCreating) {
      const newProject = await createProject(formData as Omit<Project, 'id' | 'createdAt' | 'updatedAt'>);
      if (!newProject) {
        showNotification('error', 'Gagal membuat project');
        return;
      }

      if (activities.length > 0) {
        for (const activity of activities) {
          await createActivity(newProject.id, {
            code: activity.code,
            activityName: activity.activityName,
            pic: formData.pic || '',
            weight: activity.weight,
            evidence: activity.evidence || '',
            status: (activity.status || 'not-started') as
              | 'not-started'
              | 'in-progress'
              | 'completed'
              | 'delayed'
              | 'on-hold',
            startDate: activity.startDate || null,
            endDate: activity.endDate || null,
          });
        }
      }

      const sCurveSaved = await saveSCurveForProject(newProject.id);
      if (!sCurveSaved) return;

      showNotification('success', 'Project dan S-Curve berhasil dibuat');
      loadProjects();
      handleCancel();
      return;
    }

    if (!editingProject) return;

    const success = await updateProject(editingProject.id, formData);
    if (!success) {
      showNotification('error', 'Gagal mengupdate project');
      return;
    }

    if (supabase) {
      // Update activities (delete all and recreate for simplicity)
      await supabase.from('activities').delete().eq('project_id', editingProject.id);

      for (const activity of activities) {
        await createActivity(editingProject.id, {
          code: activity.code,
          activityName: activity.activityName,
          pic: formData.pic || editingProject.pic,
          weight: activity.weight,
          evidence: activity.evidence || '',
          status: (activity.status || 'not-started') as
            | 'not-started'
            | 'in-progress'
            | 'completed'
            | 'delayed'
            | 'on-hold',
          startDate: activity.startDate || null,
          endDate: activity.endDate || null,
        });
      }
    }

    const sCurveSaved = await saveSCurveForProject(editingProject.id);
    if (!sCurveSaved) return;

    showNotification('success', 'Project dan S-Curve berhasil diupdate');
    loadProjects();
    handleCancel();
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    setDeleteConfirm({ projectId, projectName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    const success = await deleteProject(deleteConfirm.projectId);
    if (success) {
      showNotification('success', 'Project berhasil dihapus');
      loadProjects();
    } else {
      showNotification('error', 'Gagal menghapus project');
    }
    setDeleteConfirm(null);
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  // Activity management functions
  const addActivity = () => {
    setActivities([
      ...activities,
      {
        code: '',
        activityName: '',
        weight: 0,
        evidence: '',
        startDate: '',
        endDate: '',
        status: 'not-started',
      },
    ]);
  };

  const updateActivity = (index: number, field: keyof ActivityFormRow, value: string | number) => {
    const updated = [...activities];
    updated[index] = { ...updated[index], [field]: value } as ActivityFormRow;
    setActivities(updated);
  };

  const removeActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={48} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Manage Data</h1>
              <p className="text-slate-600">Kelola project, activities, dan S-Curve data</p>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              <Plus size={20} />
              Tambah Project
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
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
                Yakin ingin menghapus project <strong>"{deleteConfirm.projectName}"</strong>?
                Semua data terkait (activities, progress, S-Curve) akan terhapus.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Ya, Hapus
                </button>
                <button
                  onClick={cancelDelete}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-4 ${
              notification.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 size={20} className="text-green-600" />
            ) : (
              <AlertCircle size={20} className="text-red-600" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        {/* Form (Create/Edit) */}
        {(isCreating || editingProject) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6 animate-in slide-in-from-top-4">
            <h2 className="text-xl font-bold text-slate-900 mb-4">{isCreating ? 'Tambah Project Baru' : 'Edit Project'}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nama Project <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Monitoring Biodiversity Blora"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  PIC <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.pic || ''}
                  onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="ARIEF"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Uraian Kegiatan/Program</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows={3}
                  placeholder="Program monitoring keanekaragaman hayati..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Pilih Category</option>
                  <option value="Environmental">Environmental</option>
                  <option value="Social">Social</option>
                  <option value="Infrastructure">Infrastructure</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lokasi</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Blora, Jawa Tengah"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tanggal Mulai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate || ''}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tanggal Selesai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on-hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Budget (Rp)</label>
                <input
                  type="number"
                  value={formData.budget || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, budget: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="200000000"
                />
              </div>
            </div>

            {/* Activities Section */}
            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Activities</h3>
                  <p className="text-sm text-slate-600">Tambahkan kegiatan untuk project ini (opsional)</p>
                </div>
                <button
                  type="button"
                  onClick={addActivity}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={16} />
                  Tambah Activity
                </button>
              </div>

              {activities.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Kode</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Nama Activity</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Start Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">End Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Bobot (%)</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Evidence</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-700">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activities.map((activity, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={activity.code}
                              onChange={(e) => updateActivity(index, 'code', e.target.value)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              placeholder="A"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={activity.activityName}
                              onChange={(e) => updateActivity(index, 'activityName', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              placeholder="Nama kegiatan"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={activity.startDate}
                              onChange={(e) => updateActivity(index, 'startDate', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={activity.endDate}
                              onChange={(e) => updateActivity(index, 'endDate', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={activity.status || 'not-started'}
                              onChange={(e) => updateActivity(index, 'status', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                              <option value="not-started">Belum Dimulai</option>
                              <option value="in-progress">Sedang Berjalan</option>
                              <option value="completed">Selesai</option>
                              <option value="delayed">Terlambat</option>
                              <option value="on-hold">Ditunda</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={activity.weight}
                              onChange={(e) => updateActivity(index, 'weight', Number.parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="url"
                              value={activity.evidence || ''}
                              onChange={(e) => updateActivity(index, 'evidence', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              placeholder="https://..."
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeActivity(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold">
                        <td colSpan={5} className="px-3 py-2 text-right">
                          Total Bobot:
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`${
                              Math.abs(activities.reduce((sum, a) => sum + a.weight, 0) - 100) < 0.1
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}
                          >
                            {activities.reduce((sum, a) => sum + a.weight, 0).toFixed(1)}%
                          </span>
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activities.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                  Belum ada activity. Klik "Tambah Activity" untuk menambahkan.
                </div>
              )}
            </div>

            {/* S-Curve Section */}
            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">S-Curve Bulanan</h3>
                  <p className="text-sm text-slate-600">
                    Isi nilai kumulatif baseline dan realisasi per bulan untuk project ini.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">Tahun</label>
                  <select
                    value={selectedSCurveYear}
                    onChange={(e) => handleSCurveYearChange(Number(e.target.value))}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {availableSCurveYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingSCurve ? (
                <div className="flex items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-lg">
                  <Loader2 size={24} className="animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-slate-600">Memuat data S-Curve...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Bulan</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Baseline Kumulatif (%)</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Realisasi Kumulatif (%)</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-700">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sCurveRows.map((row) => {
                        const variance = row.cumulativeActual - row.cumulativeBaseline;

                        return (
                          <tr key={`${selectedSCurveYear}-${row.monthIndex}`} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-900">{row.monthLabel}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={row.cumulativeBaseline}
                                onChange={(e) => updateSCurveValue(row.monthIndex, 'cumulativeBaseline', e.target.value)}
                                className="w-28 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={row.cumulativeActual}
                                onChange={(e) => updateSCurveValue(row.monthIndex, 'cumulativeActual', e.target.value)}
                                className="w-28 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              <span className={variance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                {variance >= 0 ? '+' : ''}
                                {variance.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-3 text-xs text-slate-500">
                Validasi: nilai 0-100, kumulatif tidak boleh turun dari bulan sebelumnya, dan minimal satu nilai harus lebih dari 0.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Save size={18} />
                Simpan
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <X size={18} />
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 line-clamp-1">{project.name}</h3>
                    <p className="text-sm text-slate-500">PIC: {project.pic}</p>
                  </div>
                </div>
              </div>

              {project.description && <p className="text-sm text-slate-600 mb-4 line-clamp-2">{project.description}</p>}

              <div className="space-y-2 mb-4 text-sm">
                {project.location && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-medium">📍</span>
                    <span>{project.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">📅</span>
                  <span>
                    {new Date(project.startDate).toLocaleDateString('id-ID')} -{' '}
                    {new Date(project.endDate).toLocaleDateString('id-ID')}
                  </span>
                </div>
                {project.budget && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-medium">💰</span>
                    <span>Rp {(project.budget / 1000000).toFixed(0)}M</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    project.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : project.status === 'completed'
                      ? 'bg-blue-100 text-blue-700'
                      : project.status === 'on-hold'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {project.status}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(project)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && !isCreating && (
          <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp size={32} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Belum Ada Project</h3>
            <p className="text-slate-600 mb-6">Mulai dengan menambahkan project pertama Anda</p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Plus size={20} />
              Tambah Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
