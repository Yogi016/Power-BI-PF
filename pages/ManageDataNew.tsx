import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { 
  fetchProjects, 
  createProject, 
  updateProject, 
  deleteProject,
  fetchSCurveData,
  upsertSCurveBaseline,
  upsertSCurveActual
} from '../lib/supabase';
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
  Calendar
} from 'lucide-react';

export const ManageDataNew: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [activities, setActivities] = useState<Array<{
    code: string;
    activityName: string;
    weight: number;
    evidence: string;
    startDate: string;
    endDate: string;
    status: string;
  }>>([]);

  // Load projects
  useEffect(() => {
    loadProjects();
  }, []);

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
  };

  const handleEdit = async (project: Project) => {
    setIsCreating(false);
    setEditingProject(project);
    setFormData(project);
    
    // Load existing activities
    try {
      const { supabase } = await import('../lib/supabaseClient');
      if (supabase) {
        const { data } = await supabase
          .from('activities')
          .select('code, activity_name, weight, evidence, start_date, end_date, status')
          .eq('project_id', project.id);
        
        if (data) {
          setActivities(data.map(a => ({
            code: a.code,
            activityName: a.activity_name,
            weight: a.weight || 0,
            evidence: a.evidence || '',
            startDate: a.start_date || '',
            endDate: a.end_date || '',
            status: a.status || 'not-started',
          })));
        }
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingProject(null);
    setFormData({});
    setActivities([]);
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
      if (newProject) {
        // Save activities
        if (activities.length > 0) {
          const { createActivity } = await import('../lib/supabase');
          for (const activity of activities) {
            await createActivity(newProject.id, {
            code: activity.code,
            activityName: activity.activityName,
            pic: formData.pic || '',
            weight: activity.weight,
            evidence: activity.evidence || '',
            status: (activity.status || 'not-started') as 'not-started' | 'in-progress' | 'completed' | 'delayed' | 'on-hold',
            startDate: activity.startDate || null,
            endDate: activity.endDate || null,
          });
          }
        }
        showNotification('success', 'Project berhasil dibuat');
        loadProjects();
        handleCancel();
      } else {
        showNotification('error', 'Gagal membuat project');
      }
    } else if (editingProject) {
      const success = await updateProject(editingProject.id, formData);
      if (success) {
        // Update activities (delete all and recreate for simplicity)
        const { supabase } = await import('../lib/supabaseClient');
        const { createActivity } = await import('../lib/supabase');
        
        if (supabase) {
          // Delete existing activities
          await supabase.from('activities').delete().eq('project_id', editingProject.id);
          
          // Create new activities
          for (const activity of activities) {
            await createActivity(editingProject.id, {
            code: activity.code,
            activityName: activity.activityName,
            pic: formData.pic || editingProject.pic,
            weight: activity.weight,
            evidence: activity.evidence || '',
            status: (activity.status || 'not-started') as 'not-started' | 'in-progress' | 'completed' | 'delayed' | 'on-hold',
            startDate: activity.startDate || null,
            endDate: activity.endDate || null,
          });
          }
        }
        
        showNotification('success', 'Project berhasil diupdate');
        loadProjects();
        handleCancel();
      } else {
        showNotification('error', 'Gagal mengupdate project');
      }
    }
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

  const updateActivity = (index: number, field: string, value: any) => {
    const updated = [...activities];
    updated[index] = { ...updated[index], [field]: value };
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

        {/* Form (Create/Edit) */}
        {(isCreating || editingProject) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6 animate-in slide-in-from-top-4">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {isCreating ? 'Tambah Project Baru' : 'Edit Project'}
            </h2>
            
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Uraian Kegiatan/Program
                </label>
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
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value ? Number(e.target.value) : undefined })}
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
                              onChange={(e) => updateActivity(index, 'weight', parseFloat(e.target.value) || 0)}
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
                        <td colSpan={5} className="px-3 py-2 text-right">Total Bobot:</td>
                        <td className="px-3 py-2">
                          <span className={`${
                            Math.abs(activities.reduce((sum, a) => sum + a.weight, 0) - 100) < 0.1
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
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

              {project.description && (
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="space-y-2 mb-4 text-sm">
                {project.location && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-medium">📍</span>
                    <span>{project.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">📅</span>
                  <span>{new Date(project.startDate).toLocaleDateString('id-ID')} - {new Date(project.endDate).toLocaleDateString('id-ID')}</span>
                </div>
                {project.budget && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-medium">💰</span>
                    <span>Rp {(project.budget / 1000000).toFixed(0)}M</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  project.status === 'active' ? 'bg-green-100 text-green-700' :
                  project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                  project.status === 'on-hold' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
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
            <p className="text-slate-600 mb-6">
              Mulai dengan menambahkan project pertama Anda
            </p>
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
