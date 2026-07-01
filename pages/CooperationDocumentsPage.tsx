import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  GitBranch,
  Loader2,
  Plus,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createCooperationDocumentDraft, fetchCooperationDocuments, fetchProjects, uploadCooperationDocumentFile } from '../lib/supabase';
import {
  buildCooperationTasks,
  buildRoleDocumentInbox,
  distributeCooperationDocumentWeights,
  getCooperationStatusLabel,
  getRoleDashboardConfig,
  hasSignedDocument,
} from '../lib/cooperationWorkflow';
import type { CooperationDocument, CooperationDocumentType, Project } from '../types';

type CreateFormState = {
  title: string;
  documentType: CooperationDocumentType;
  partnerName: string;
  documentNumber: string;
  startDate: string;
  endDate: string;
  internalPic: string;
  projectHead: string;
  projectManager: string;
  scopeSummary: string;
  projectId: string;
};

type Notice = { type: 'success' | 'error'; message: string } | null;

const DEFAULT_CREATE_FORM: CreateFormState = {
  title: '',
  documentType: 'PKS',
  partnerName: '',
  documentNumber: '',
  startDate: '',
  endDate: '',
  internalPic: '',
  projectHead: '',
  projectManager: '',
  scopeSummary: '',
  projectId: '',
};

const COOPERATION_DOCUMENT_TYPE_OPTIONS: CooperationDocumentType[] = [
  'PKS',
  'MOU',
  'MoA',
  'Addendum',
  'BAST',
  'NDA',
  'SK',
  'Surat Dukungan',
  'Lainnya',
];

export const CooperationDocumentsPage: React.FC = () => {
  const { role, roleProfile, user } = useAuth();
  const [cooperationDocuments, setCooperationDocuments] = useState<CooperationDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingCooperationDocs, setLoadingCooperationDocs] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCooperationDocuments = async () => {
      setLoadingCooperationDocs(true);
      const [docs, projectRows] = await Promise.all([
        fetchCooperationDocuments(),
        fetchProjects(),
      ]);
      if (!isMounted) return;

      setCooperationDocuments(docs);
      setProjects(projectRows);
      setLoadingCooperationDocs(false);
    };

    loadCooperationDocuments();

    return () => {
      isMounted = false;
    };
  }, []);

  const roleConfig = useMemo(() => getRoleDashboardConfig(role), [role]);
  const canCreateCooperationDocument = role === 'staff_officer';

  const roleInboxDocs = useMemo(
    () => buildRoleDocumentInbox(cooperationDocuments, role),
    [cooperationDocuments, role]
  );

  const documentWeights = useMemo(
    () => distributeCooperationDocumentWeights(cooperationDocuments),
    [cooperationDocuments]
  );

  const cooperationMetrics = useMemo(() => {
    const now = new Date();
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    return {
      total: cooperationDocuments.length,
      waitingVp: cooperationDocuments.filter(doc => doc.status === 'menunggu-approval-vp').length,
      active: cooperationDocuments.filter(doc => doc.status === 'aktif' || doc.status === 'monitoring-implementasi').length,
      expiring: cooperationDocuments.filter(doc => {
        if (!doc.endDate) return false;
        const endDate = new Date(doc.endDate);
        return endDate >= now && endDate <= sixtyDaysFromNow;
      }).length,
    };
  }, [cooperationDocuments]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getCooperationStatusClass = (status: CooperationDocument['status']) => {
    if (status === 'menunggu-approval-vp' || status === 'validasi-project-manager') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (status === 'aktif' || status === 'monitoring-implementasi') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (status === 'expired' || status === 'diarsipkan') {
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    if (status === 'revisi-final') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const getActiveCooperationTask = (doc: CooperationDocument) => {
    const tasks = buildCooperationTasks(doc);
    return tasks.find(task => task.status === 'in-progress')
      || tasks.find(task => task.status === 'completed')
      || null;
  };

  const getExpiryText = (doc: CooperationDocument) => {
    if (!doc.endDate) return 'Tanpa masa berlaku';
    const now = new Date();
    const endDate = new Date(doc.endDate);
    const dayDiff = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (dayDiff < 0) return `Expired ${Math.abs(dayDiff)} hari lalu`;
    if (dayDiff <= 60) return `Berakhir dalam ${dayDiff} hari`;
    return `Berakhir ${formatDate(doc.endDate)}`;
  };

  const reloadCooperationDocuments = async () => {
    const docs = await fetchCooperationDocuments();
    setCooperationDocuments(docs);
  };

  const resetCreateForm = () => {
    setCreateForm(DEFAULT_CREATE_FORM);
    setSelectedFile(null);
  };

  const handleCreateFormChange = <K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) => {
    setCreateForm(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    if (!canCreateCooperationDocument) {
      setNotice({ type: 'error', message: 'Hanya Staff Officer yang membuat draft awal PKS/MOU.' });
      return;
    }

    if (!createForm.title.trim() || !createForm.partnerName.trim() || !createForm.internalPic.trim()) {
      setNotice({ type: 'error', message: 'Judul, mitra, dan PIC internal wajib diisi.' });
      return;
    }

    if (!selectedFile) {
      setNotice({ type: 'error', message: 'Upload file draft PKS/MOU terlebih dahulu.' });
      return;
    }

    setSavingDraft(true);

    try {
      const uploaded = await uploadCooperationDocumentFile(selectedFile, createForm.documentType);
      if (!uploaded) throw new Error('Upload file ke R2 gagal.');

      const selectedProject = projects.find(project => project.id === createForm.projectId);
      const documentId = await createCooperationDocumentDraft({
        title: createForm.title.trim(),
        documentType: createForm.documentType,
        partnerName: createForm.partnerName.trim(),
        documentNumber: createForm.documentNumber.trim() || null,
        startDate: createForm.startDate || null,
        endDate: createForm.endDate || null,
        internalPic: createForm.internalPic.trim(),
        projectHead: createForm.projectHead.trim() || null,
        projectManager: createForm.projectManager.trim() || null,
        scopeSummary: createForm.scopeSummary.trim() || null,
        createdBy: user?.id || null,
        version: {
          versionLabel: 'Draft v1',
          fileName: selectedFile.name,
          fileUrl: uploaded.url,
          storageKey: uploaded.storageKey,
          uploadedBy: user?.id || null,
          statusAtUpload: 'draft-internal',
          revisionNotes: 'Upload draft awal oleh Staff Officer.',
          revisionSource: 'internal',
        },
        projectLink: selectedProject
          ? {
              projectId: selectedProject.id,
              projectName: selectedProject.name,
              documentWeight: 20,
            }
          : null,
      });

      if (!documentId) throw new Error('Dokumen gagal disimpan ke Supabase.');

      await reloadCooperationDocuments();
      resetCreateForm();
      setShowCreateForm(false);
      setNotice({ type: 'success', message: 'Draft PKS/MOU berhasil dibuat dan evidence Draft v1 tersimpan di R2.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Draft PKS/MOU gagal dibuat.';
      setNotice({ type: 'error', message });
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="text-emerald-600" size={24} />
            Workspace PKS/MOU
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola workflow dokumen kerja sama, approval, evidence, dan task project otomatis
          </p>
        </div>
        {canCreateCooperationDocument && (
          <button
            type="button"
            onClick={() => setShowCreateForm(prev => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={savingDraft}
          >
            {showCreateForm ? <X size={16} /> : <Plus size={16} />}
            {showCreateForm ? 'Tutup Draft' : 'Draft PKS/MOU'}
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-auto rounded p-0.5 hover:bg-white/70"
            aria-label="Tutup notifikasi"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {showCreateForm && canCreateCooperationDocument && (
        <form onSubmit={handleCreateDraft} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Draft Baru PKS/MOU</h2>
              <p className="text-sm text-slate-500">Status awal: Draft Internal</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
              <Upload size={13} />
              R2 documents/pks-mou
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Jenis</span>
              <select
                value={createForm.documentType}
                onChange={event => handleCreateFormChange('documentType', event.target.value as CooperationDocumentType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {COOPERATION_DOCUMENT_TYPE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 lg:col-span-2">
              <span className="text-xs font-bold uppercase text-slate-500">Judul Dokumen</span>
              <input
                value={createForm.title}
                onChange={event => handleCreateFormChange('title', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Contoh: PKS Restorasi Mangrove Mahakam"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Mitra</span>
              <input
                value={createForm.partnerName}
                onChange={event => handleCreateFormChange('partnerName', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Nama mitra"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">No Dokumen</span>
              <input
                value={createForm.documentNumber}
                onChange={event => handleCreateFormChange('documentNumber', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Opsional"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">PIC Internal</span>
              <input
                value={createForm.internalPic}
                onChange={event => handleCreateFormChange('internalPic', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder={user?.email || 'Nama PIC'}
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Mulai</span>
              <input
                type="date"
                value={createForm.startDate}
                onChange={event => handleCreateFormChange('startDate', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Berakhir</span>
              <input
                type="date"
                value={createForm.endDate}
                onChange={event => handleCreateFormChange('endDate', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Link Project</span>
              <select
                value={createForm.projectId}
                onChange={event => handleCreateFormChange('projectId', event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Belum dihubungkan</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Project Head</span>
              <input
                value={createForm.projectHead}
                onChange={event => handleCreateFormChange('projectHead', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Opsional"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Project Manager</span>
              <input
                value={createForm.projectManager}
                onChange={event => handleCreateFormChange('projectManager', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Opsional"
              />
            </label>

            <label className="space-y-1.5 lg:col-span-2">
              <span className="text-xs font-bold uppercase text-slate-500">Upload Draft ke R2</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png"
                onChange={event => setSelectedFile(event.target.files?.[0] || null)}
                className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white hover:bg-slate-100"
              />
              <p className="text-xs text-slate-500">File disimpan di prefix R2: documents/pks-mou/jenis/tahun/bulan.</p>
            </label>

            <label className="space-y-1.5 lg:col-span-3">
              <span className="text-xs font-bold uppercase text-slate-500">Ruang Lingkup</span>
              <textarea
                value={createForm.scopeSummary}
                onChange={event => handleCreateFormChange('scopeSummary', event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Ringkasan kerja sama"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={resetCreateForm}
              disabled={savingDraft}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={savingDraft}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {savingDraft ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {savingDraft ? 'Menyimpan...' : 'Simpan Draft'}
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                <ShieldCheck size={13} />
                {roleProfile.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                <FileText size={13} />
                Page terpisah dari arsip dokumen
              </span>
              {!loadingCooperationDocs && cooperationDocuments.length === 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  <AlertCircle size={13} />
                  Belum ada data PKS/MOU
                </span>
              )}
            </div>
            <h2 className="mt-3 text-lg font-bold text-slate-900">Dokumen Kerja Sama</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              {roleConfig.focusTitle}. {roleProfile.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Total', value: cooperationMetrics.total, icon: <FileText size={16} />, tone: 'text-slate-700' },
              { label: 'Approval VP', value: cooperationMetrics.waitingVp, icon: <ShieldCheck size={16} />, tone: 'text-amber-700' },
              { label: 'Aktif', value: cooperationMetrics.active, icon: <BadgeCheck size={16} />, tone: 'text-emerald-700' },
              { label: 'Hampir Expired', value: cooperationMetrics.expiring, icon: <Clock3 size={16} />, tone: 'text-rose-700' },
            ].map(item => (
              <div key={item.label} className="min-w-[92px] rounded-lg border border-white/80 bg-white px-3 py-2 shadow-sm">
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${item.tone}`}>
                  {item.icon}
                  {item.label}
                </div>
                <p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{roleConfig.inboxTitle}</h3>
                <p className="text-xs text-slate-500">Task inbox mengikuti role login.</p>
              </div>
              <ClipboardList className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="mt-3 space-y-2">
              {loadingCooperationDocs ? (
                <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-3 text-sm text-slate-500">
                  <Loader2 size={15} className="animate-spin text-emerald-600" />
                  Memuat dokumen kerja sama...
                </div>
              ) : roleInboxDocs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                  {roleConfig.emptyText}
                </div>
              ) : (
                roleInboxDocs.slice(0, 4).map(doc => {
                  const task = getActiveCooperationTask(doc);
                  return (
                    <div key={doc.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{doc.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{doc.partnerName}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${getCooperationStatusClass(doc.status)}`}>
                          {getCooperationStatusLabel(doc.status)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <GitBranch size={13} className="text-emerald-600" />
                        <span>{task?.label || 'Workflow selesai'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Board PKS/MOU dan Kerja Sama</h3>
                <p className="text-xs text-slate-500">Status dokumen menggerakkan task project otomatis dan evidence.</p>
              </div>
              <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 sm:inline-flex">
                Pool project 20%
              </span>
            </div>

            <div className="overflow-x-auto">
              {loadingCooperationDocs ? (
                <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 size={18} className="animate-spin text-emerald-600" />
                  Memuat dokumen kerja sama...
                </div>
              ) : cooperationDocuments.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                  <ClipboardList size={42} className="mb-3 text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">Belum ada dokumen PKS/MOU</p>
                  <p className="mt-1 max-w-md text-sm text-slate-500">
                    Data akan muncul setelah tabel Supabase berisi dokumen kerja sama real. Tidak ada data contoh yang ditampilkan di page ini.
                  </p>
                </div>
              ) : (
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="bg-white text-left text-xs font-bold uppercase text-slate-500">
                      <th className="px-3 py-2">Dokumen</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Project / Bobot</th>
                      <th className="px-3 py-2">Task Aktif</th>
                      <th className="px-3 py-2">Evidence</th>
                      <th className="px-3 py-2">Masa Berlaku</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cooperationDocuments.map(doc => {
                      const task = getActiveCooperationTask(doc);
                      const signed = hasSignedDocument(doc.versions);
                      const projectName = doc.projectLinks[0]?.projectName || 'Belum terhubung project';
                      const projectWeight = doc.projectLinks[0]?.documentWeight ?? documentWeights[doc.id] ?? 0;

                      return (
                        <tr key={doc.id} className="bg-white hover:bg-slate-50/80">
                          <td className="px-3 py-3 align-top">
                            <p className="font-bold text-slate-900">{doc.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">{doc.documentType}</span>
                              <span className="inline-flex items-center gap-1"><Users size={12} /> {doc.partnerName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getCooperationStatusClass(doc.status)}`}>
                              {getCooperationStatusLabel(doc.status)}
                            </span>
                            {signed && (
                              <p className="mt-1 text-xs font-medium text-emerald-700">Signed tersedia</p>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <p className="text-sm font-semibold text-slate-800">{projectName}</p>
                            <p className="mt-1 text-xs text-slate-500">Bobot dokumen: <span className="font-bold text-slate-800">{projectWeight.toFixed(2)}%</span></p>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <p className="text-sm font-semibold text-slate-800">{task?.label || 'Workflow selesai'}</p>
                            <p className="mt-1 text-xs text-slate-500">Task otomatis mengikuti status dokumen.</p>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-wrap gap-1.5">
                              {doc.versions.slice(0, 3).map(version => (
                                <a
                                  key={version.id}
                                  href={version.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                >
                                  {version.versionLabel}
                                </a>
                              ))}
                              {doc.versions.length > 3 && (
                                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">+{doc.versions.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <p className="text-sm font-semibold text-slate-800">{getExpiryText(doc)}</p>
                            <p className="mt-1 text-xs text-slate-500">{formatDate(doc.startDate)} - {formatDate(doc.endDate)}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
