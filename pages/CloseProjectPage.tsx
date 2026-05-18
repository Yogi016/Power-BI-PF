import React, { useEffect, useMemo, useState } from 'react';
import { Archive, AlertCircle, Building2, Calendar, CheckCircle2, Download, ExternalLink, FileText, Image as ImageIcon, ListChecks, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { Project } from '../types';
import { fetchActivities, fetchClosedProjects, fetchSCurveData, updateProject } from '../lib/supabase';
import { generateProjectPDF, type ProjectPDFData } from '../utils/generateProjectPDF';
import { formatBudgetJuta } from '../utils/formatters';

interface ClosedProjectActivity {
  code: string;
  activityName: string;
  startDate: string;
  endDate: string;
  status: string;
  weight: number;
  evidence: string[];
}

const statusLabels: Record<string, string> = {
  'not-started': 'Belum Mulai',
  'in-progress': 'Berjalan',
  completed: 'Selesai',
  delayed: 'Terlambat',
  'on-hold': 'Ditunda',
};

const parseEvidence = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [raw];
    } catch {
      return raw.trim() ? [raw] : [];
    }
  }
  return [];
};

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getEvidenceFileName = (fileUrl: string, index: number): string => {
  try {
    const pathname = new URL(fileUrl).pathname;
    const filename = pathname.split('/').filter(Boolean).pop();
    return filename ? safeDecode(filename) : `File ${index + 1}`;
  } catch {
    const filename = fileUrl.split('/').filter(Boolean).pop();
    return filename ? safeDecode(filename) : `File ${index + 1}`;
  }
};

const EvidenceLinks = ({ urls, compact = false }: { urls: string[]; compact?: boolean }) => {
  if (urls.length === 0) {
    return <span className="text-xs font-medium text-slate-400">-</span>;
  }

  return (
    <div className={compact ? 'grid grid-cols-1 gap-1.5' : 'space-y-1'}>
      {urls.map((fileUrl, fileIndex) => {
        const isPdf = /\.pdf($|\?)/i.test(fileUrl);

        return (
          <a
            key={`${fileUrl}-${fileIndex}`}
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 ${compact ? 'max-w-full' : 'max-w-[220px]'}`}
            title={fileUrl}
          >
            {isPdf ? (
              <FileText size={13} className="flex-shrink-0 text-red-500" />
            ) : (
              <ImageIcon size={13} className="flex-shrink-0 text-emerald-500" />
            )}
            <span className="truncate">{getEvidenceFileName(fileUrl, fileIndex)}</span>
            <ExternalLink size={11} className="flex-shrink-0 text-slate-400" />
          </a>
        );
      })}
    </div>
  );
};

export const CloseProjectPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailActivities, setDetailActivities] = useState<ClosedProjectActivity[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    void loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const data = await fetchClosedProjects();
    setProjects(data);
    setLoading(false);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const availableYears = useMemo(() => {
    return Array.from(
      new Set(projects.map((project) => new Date(project.startDate).getFullYear()))
    ).sort((a, b) => b - a);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesYear = selectedYear
        ? new Date(project.startDate).getFullYear() === selectedYear
        : true;

      if (!matchesYear) return false;
      if (!query) return true;

      return [
        project.name,
        project.pic,
        project.description,
        project.category,
        project.location,
        project.status,
        project.startDate ? new Date(project.startDate).getFullYear().toString() : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [projects, projectSearch, selectedYear]);

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID');
  };

  const mapActivity = (activity: any): ClosedProjectActivity => ({
    code: activity.code || '-',
    activityName: activity.activityName || activity.activity || '-',
    startDate: activity.startDate || '',
    endDate: activity.endDate || '',
    status: activity.status || 'not-started',
    weight: activity.weight || 0,
    evidence: parseEvidence(activity.evidence),
  });

  const handleOpenProjectDetail = async (project: Project) => {
    setSelectedProject(project);
    setDetailActivities([]);
    setLoadingDetail(true);

    try {
      const activities = (await fetchActivities(project.id)) as any[];
      setDetailActivities(activities.map(mapActivity));
    } catch (error) {
      console.error('Error loading closed project activities:', error);
      showNotification('error', 'Gagal memuat detail kegiatan');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseProjectDetail = () => {
    setSelectedProject(null);
    setDetailActivities([]);
    setLoadingDetail(false);
  };

  const handleReopenProject = async (project: Project) => {
    const confirmed = window.confirm(`Aktifkan kembali project "${project.name}"? Project akan kembali ke Manage Data.`);
    if (!confirmed) return;

    setReopeningId(project.id);
    const success = await updateProject(project.id, { status: 'active' });
    if (success) {
      showNotification('success', `"${project.name}" dikembalikan ke Manage Data`);
      await loadProjects();
    } else {
      showNotification('error', 'Gagal membuka kembali project');
    }
    setReopeningId(null);
  };

  const handleDownloadPDF = async (project: Project) => {
    setGeneratingPdfId(project.id);
    try {
      const activities = ((await fetchActivities(project.id)) as any[]).map(mapActivity);
      const sCurveData = await fetchSCurveData(project.id, 'monthly');

      const pdfData: ProjectPDFData = {
        id: project.id,
        name: project.name,
        pic: project.pic,
        description: project.description,
        category: project.category,
        location: project.location,
        startDate: project.startDate,
        endDate: project.endDate,
        status: project.status,
        budget: project.budget,
        activities,
        sCurveData: sCurveData.map((point) => ({
          periodLabel: point.periodLabel,
          baseline: point.baseline,
          actual: point.actual,
        })),
        signatures: [],
      };

      await generateProjectPDF(pdfData);
      showNotification('success', `PDF "${project.name}" dibuka di tab baru`);
    } catch (error) {
      console.error('Error generating closed project PDF:', error);
      showNotification('error', 'Gagal membuat PDF');
    } finally {
      setGeneratingPdfId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={48} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 pb-24 sm:p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Close Project</h1>
              <p className="text-sm sm:text-base text-slate-600">Arsip project yang sudah selesai dan ditutup</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-80">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={projectSearch}
                  onChange={(event) => setProjectSearch(event.target.value)}
                  placeholder="Cari project close..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                {projectSearch && (
                  <button
                    type="button"
                    onClick={() => setProjectSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Hapus pencarian"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {availableYears.length > 1 && (
                <div className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm sm:w-auto">
                  <Calendar size={16} className="text-slate-500" />
                  <select
                    value={selectedYear ?? ''}
                    onChange={(event) => setSelectedYear(event.target.value ? Number(event.target.value) : null)}
                    className="min-w-0 flex-1 cursor-pointer bg-transparent font-medium text-slate-700 outline-none sm:flex-none"
                    aria-label="Filter tahun close project"
                  >
                    <option value="">Semua Tahun</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {notification && (
          <div
            className={`fixed left-3 right-3 top-3 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg sm:left-auto sm:right-4 ${notification.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
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

        {selectedProject && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
            onClick={handleCloseProjectDetail}
          >
            <div
              className="h-[92vh] w-full max-w-5xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 sm:h-11 sm:w-11">
                    <ListChecks size={21} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-lg font-bold leading-snug text-slate-900 sm:text-xl">{selectedProject.name}</h2>
                    <p className="text-sm text-slate-500">Detail kegiatan project close</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseProjectDetail}
                  className="flex-shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Tutup detail project"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="h-[calc(92vh-78px)] overflow-y-auto p-4 sm:h-auto sm:max-h-[calc(90vh-88px)] sm:p-5">
                <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2 sm:mb-5 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">PIC</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{selectedProject.pic || '-'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lokasi</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{selectedProject.location || '-'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Timeline</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatDate(selectedProject.startDate)} - {formatDate(selectedProject.endDate)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Budget</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatBudgetJuta(selectedProject.budget)}
                    </p>
                  </div>
                </div>

                {selectedProject.description && (
                  <div className="rounded-lg border border-slate-200 p-4 mb-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Uraian Kegiatan/Program</p>
                    <p className="text-sm leading-6 text-slate-700">{selectedProject.description}</p>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h3 className="font-bold text-slate-900">Daftar Kegiatan</h3>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                      {detailActivities.length} kegiatan
                    </span>
                  </div>

                  {loadingDetail ? (
                    <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
                      <Loader2 size={20} className="animate-spin" />
                      <span className="text-sm font-medium">Memuat kegiatan...</span>
                    </div>
                  ) : detailActivities.length > 0 ? (
                    <>
                      <div className="divide-y divide-slate-100 md:hidden">
                        {detailActivities.map((activity, index) => (
                          <div key={`${activity.code}-${index}-mobile`} className="p-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                                    {activity.code}
                                  </span>
                                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                    {statusLabels[activity.status] || activity.status}
                                  </span>
                                </div>
                                <h4 className="text-sm font-semibold leading-5 text-slate-900">{activity.activityName}</h4>
                              </div>
                              <span className="flex-shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                {activity.weight}%
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 text-sm text-slate-600">
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tanggal</p>
                                <p className="font-medium text-slate-700">
                                  {formatDate(activity.startDate)} - {formatDate(activity.endDate)}
                                </p>
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Evidence</p>
                                <EvidenceLinks urls={activity.evidence} compact />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[920px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Kode</th>
                            <th className="px-4 py-3 font-semibold">Kegiatan</th>
                            <th className="px-4 py-3 font-semibold">Tanggal</th>
                            <th className="px-4 py-3 font-semibold">Bobot</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Evidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detailActivities.map((activity, index) => (
                            <tr key={`${activity.code}-${index}`} className="text-slate-700">
                              <td className="px-4 py-3 font-medium text-slate-900">{activity.code}</td>
                              <td className="px-4 py-3">{activity.activityName}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {formatDate(activity.startDate)} - {formatDate(activity.endDate)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">{activity.weight}%</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  {statusLabels[activity.status] || activity.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <EvidenceLinks urls={activity.evidence} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </>
                  ) : (
                    <div className="p-10 text-center">
                      <p className="font-semibold text-slate-700">Belum ada kegiatan</p>
                      <p className="mt-1 text-sm text-slate-500">Project ini tidak memiliki activity yang tersimpan.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => void handleOpenProjectDetail(project)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void handleOpenProjectDetail(project);
                  }
                }}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 sm:p-6"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 sm:h-12 sm:w-12">
                      <Building2 size={22} className="text-emerald-600 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 font-bold leading-snug text-slate-900 sm:line-clamp-1">{project.name}</h3>
                      <p className="text-sm text-slate-500">PIC: {project.pic}</p>
                    </div>
                  </div>
                </div>

                {project.description && (
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{project.description}</p>
                )}

                <div className="mb-4 space-y-2 text-sm text-slate-600">
                  {project.location && <p>{project.location}</p>}
                  <p>{formatDate(project.startDate)} - {formatDate(project.endDate)}</p>
                  {project.budget && <p>{formatBudgetJuta(project.budget)}</p>}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    closed
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDownloadPDF(project);
                      }}
                      disabled={generatingPdfId === project.id}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:text-slate-300"
                      title="Download PDF"
                      aria-label={`Download PDF ${project.name}`}
                    >
                      {generatingPdfId === project.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleReopenProject(project);
                      }}
                      disabled={reopeningId === project.id}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-slate-300"
                      title="Reopen Project"
                      aria-label={`Reopen project ${project.name}`}
                    >
                      {reopeningId === project.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Archive size={32} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {projects.length === 0 ? 'Belum Ada Close Project' : 'Project Tidak Ditemukan'}
            </h3>
            <p className="text-slate-600 mb-6">
              {projects.length === 0
                ? 'Project yang sudah ditutup akan muncul di halaman ini.'
                : 'Tidak ada close project yang cocok dengan pencarian atau filter tahun saat ini.'}
            </p>
            {projects.length > 0 && (
              <button
                onClick={() => {
                  setProjectSearch('');
                  setSelectedYear(null);
                }}
                className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Reset Filter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
