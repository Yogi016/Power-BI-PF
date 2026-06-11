import { supabase } from './supabaseClient';
import { generateChatbotAnswer, isGeminiAvailable } from './geminiService';
import { prepareReportAction, type ReportAction } from './reportAgent';
import {
  assetToSource,
  buildAssetSummary,
  scoreAssetSource,
  type ChatbotAssetLink,
  type ChatbotAssetRow,
  type ChatbotAssetSummary,
} from './chatbotAssetUtils';
import type { ChatbotSource } from './chatbotTypes';

type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'cancelled';
type RiskLevel = 'low' | 'medium' | 'high' | 'completed' | 'unknown';

interface ProjectRow {
  id: string;
  name: string;
  pic: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  start_date: string;
  end_date: string;
  status: ProjectStatus;
  budget?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface ActivityRow {
  id: string;
  project_id: string;
  code?: string | null;
  activity_name: string;
  category?: string | null;
  sub_category?: string | null;
  pic?: string | null;
  weight?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  evidence?: string | null;
}

interface SCurveRow {
  project_id: string;
  period_label: string;
  period_index: number;
  year: number;
  cumulative_baseline?: number | null;
  cumulative_actual?: number | null;
  period_baseline?: number | null;
  period_actual?: number | null;
}

interface DocumentRow {
  id: string;
  category_id: string;
  no_surat?: string | null;
  tanggal?: string | null;
  deskripsi?: string | null;
  jenis_dokumen?: string | null;
  link?: string | null;
  has_softfile?: boolean | null;
  has_hardfile?: boolean | null;
  keterangan?: string | null;
  created_at?: string;
}

interface DocumentCategoryRow {
  id: string;
  name: string;
}

interface EvidenceLink {
  id: string;
  url: string;
  label: string;
  fileType: 'image' | 'pdf' | 'file';
  projectName: string;
  activityCode?: string | null;
  activityName: string;
  activityStatus?: string | null;
}

interface DocumentLink {
  id: string;
  category: string;
  noSurat?: string | null;
  tanggal?: string | null;
  deskripsi?: string | null;
  jenisDokumen?: string | null;
  link?: string | null;
  hasSoftfile: boolean;
  hasHardfile: boolean;
}

interface ProjectInsight {
  id: string;
  name: string;
  pic: string;
  status: ProjectStatus;
  category?: string | null;
  location?: string | null;
  startDate: string;
  endDate: string;
  budget?: number | null;
  totalActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  delayedActivities: number;
  notStartedActivities: number;
  evidenceItems: number;
  actualProgress: number;
  plannedProgress: number;
  variance: number;
  latestPeriod?: string;
  daysRemaining: number;
  isOverdue: boolean;
  completionRate: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
  estimatedFinishDate?: string;
  estimatedFinishLabel: string;
  evidenceLinks: EvidenceLink[];
}

interface ChatbotSnapshot {
  generatedAt: string;
  totals: {
    totalProjects: number;
    activeProjects: number;
    onHoldProjects: number;
    completedProjects: number;
    cancelledProjects: number;
    ongoingProjects: number;
    delayedProjects: number;
    atRiskProjects: number;
    overdueProjects: number;
    avgActualProgress: number;
    totalActivities: number;
    totalDocuments: number;
    softfileDocuments: number;
    hardfileDocuments: number;
    totalAssets: number;
    totalAssetSize: number;
  };
  projects: ProjectInsight[];
  documents: {
    byCategory: Array<{ category: string; count: number }>;
    recent: Array<{
      noSurat?: string | null;
      tanggal?: string | null;
      deskripsi?: string | null;
      jenisDokumen?: string | null;
      link?: string | null;
      category: string;
      hasSoftfile: boolean;
      hasHardfile: boolean;
    }>;
    items: DocumentLink[];
  };
  assets: ChatbotAssetSummary;
  warnings: string[];
}

export interface ChatbotAnswer {
  answer: string;
  usedAI: boolean;
  sources: ChatbotSource[];
  action?: ReportAction;
}

const MAX_PROJECTS_IN_CONTEXT = 80;
const MAX_DOCUMENTS_IN_CONTEXT = 18;
const MAX_SOURCES_IN_CONTEXT = 10;
const MAX_SOURCES_IN_UI = 8;

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return 'Tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function daysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getFileName(fileUrl: string, index: number): string {
  try {
    const pathname = new URL(fileUrl).pathname;
    const filename = pathname.split('/').filter(Boolean).pop();
    return filename ? safeDecode(filename) : `File ${index + 1}`;
  } catch {
    const filename = fileUrl.split('/').filter(Boolean).pop();
    return filename ? safeDecode(filename) : `File ${index + 1}`;
  }
}

function getFileType(fileUrl: string): EvidenceLink['fileType'] {
  if (/\.pdf($|\?)/i.test(fileUrl)) return 'pdf';
  if (/\.(jpe?g|png|webp|gif)($|\?)/i.test(fileUrl)) return 'image';
  return 'file';
}

function parseEvidenceUrls(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
  } catch {
    return raw.trim() ? [raw] : [];
  }
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s.-]/gu, ' ');
}

function getQuestionTokens(question: string): string[] {
  const stopWords = new Set([
    'yang', 'dan', 'atau', 'apa', 'mana', 'untuk', 'dengan', 'dari', 'pada',
    'project', 'proyek', 'evidence', 'dokumen', 'link', 'file', 'kasih',
    'tampilkan', 'berikan', 'ada', 'saya', 'mau', 'tolong',
  ]);

  return Array.from(new Set(
    normalizeText(question)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !stopWords.has(token))
  ));
}

function statusLabel(status?: string | null): string {
  const labels: Record<string, string> = {
    'not-started': 'Belum Dimulai',
    'in-progress': 'Berjalan',
    completed: 'Selesai',
    delayed: 'Terlambat',
    'on-hold': 'Ditunda',
  };

  return status ? labels[status] || status : 'Status tidak tersedia';
}

async function readQuery<T>(
  query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  label: string
): Promise<{ data: T[]; warning?: string }> {
  try {
    const { data, error } = await query;
    if (error) {
      return { data: [], warning: `${label}: ${error.message || 'gagal dibaca'}` };
    }
    return { data: data || [] };
  } catch (error) {
    return { data: [], warning: `${label}: ${error instanceof Error ? error.message : 'gagal dibaca'}` };
  }
}

function buildLatestProgress(
  baselineRows: SCurveRow[],
  actualRows: SCurveRow[]
): Map<string, {
  actualProgress: number;
  plannedProgress: number;
  variance: number;
  latestPeriod?: string;
}> {
  const baselineByPeriod = new Map<string, SCurveRow>();
  const actualByProject = new Map<string, SCurveRow[]>();
  const baselineByProject = new Map<string, SCurveRow[]>();

  baselineRows.forEach((row) => {
    baselineByPeriod.set(`${row.project_id}:${row.year}:${row.period_index}`, row);
    const existing = baselineByProject.get(row.project_id) || [];
    existing.push(row);
    baselineByProject.set(row.project_id, existing);
  });

  actualRows.forEach((row) => {
    const existing = actualByProject.get(row.project_id) || [];
    existing.push(row);
    actualByProject.set(row.project_id, existing);
  });

  const projectIds = new Set([
    ...Array.from(baselineByProject.keys()),
    ...Array.from(actualByProject.keys()),
  ]);

  const latestByProject = new Map<string, {
    actualProgress: number;
    plannedProgress: number;
    variance: number;
    latestPeriod?: string;
  }>();

  projectIds.forEach((projectId) => {
    const actualRowsForProject = [...(actualByProject.get(projectId) || [])].sort(sortPeriodRows);
    const baselineRowsForProject = [...(baselineByProject.get(projectId) || [])].sort(sortPeriodRows);
    const latestActual = actualRowsForProject[actualRowsForProject.length - 1];
    const latestBaseline = baselineRowsForProject[baselineRowsForProject.length - 1];
    const referenceRow = latestActual || latestBaseline;

    if (!referenceRow) return;

    const baselineForPeriod = baselineByPeriod.get(`${projectId}:${referenceRow.year}:${referenceRow.period_index}`) || latestBaseline;
    const actualProgress = toNumber(latestActual?.cumulative_actual);
    const plannedProgress = toNumber(baselineForPeriod?.cumulative_baseline);

    latestByProject.set(projectId, {
      actualProgress,
      plannedProgress,
      variance: actualProgress - plannedProgress,
      latestPeriod: `${referenceRow.period_label} ${referenceRow.year}`,
    });
  });

  return latestByProject;
}

function sortPeriodRows(a: SCurveRow, b: SCurveRow): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.period_index - b.period_index;
}

function estimateFinishDate(project: ProjectRow, actualProgress: number, today: Date): string | undefined {
  if (project.status === 'completed' || actualProgress >= 100) return project.end_date;
  const startDate = parseDate(project.start_date);
  if (!startDate || actualProgress <= 0) return undefined;

  const elapsedDays = Math.max(1, daysBetween(startDate, today));
  const estimatedTotalDays = elapsedDays / (actualProgress / 100);
  const estimated = new Date(startDate);
  estimated.setDate(estimated.getDate() + Math.ceil(estimatedTotalDays));

  return estimated.toISOString().slice(0, 10);
}

function buildRisk(project: ProjectRow, insight: Omit<ProjectInsight, 'riskLevel' | 'riskReasons'>): {
  riskLevel: RiskLevel;
  riskReasons: string[];
} {
  if (project.status === 'completed') {
    return { riskLevel: 'completed', riskReasons: ['Project berstatus completed'] };
  }

  const reasons: string[] = [];
  if (insight.isOverdue) reasons.push('Tanggal selesai sudah lewat dan progress belum 100%');
  if (insight.delayedActivities > 0) reasons.push(`${insight.delayedActivities} aktivitas delayed`);
  if (insight.variance <= -10) reasons.push(`Progress tertinggal ${Math.abs(insight.variance).toFixed(1)} poin dari rencana`);
  if (insight.daysRemaining <= 30 && insight.actualProgress < 90) reasons.push('Sisa waktu kurang dari 30 hari dengan progress di bawah 90%');

  if (reasons.length > 0) {
    const highRisk = insight.isOverdue || insight.delayedActivities > 0 || insight.variance <= -10;
    return { riskLevel: highRisk ? 'high' : 'medium', riskReasons: reasons };
  }

  if (!insight.latestPeriod) {
    return { riskLevel: 'unknown', riskReasons: ['Data S-Curve belum tersedia'] };
  }

  return { riskLevel: 'low', riskReasons: ['Progress tidak menunjukkan risiko tinggi dari data yang tersedia'] };
}

function buildProjectInsights(
  projects: ProjectRow[],
  activities: ActivityRow[],
  progressByProject: Map<string, {
    actualProgress: number;
    plannedProgress: number;
    variance: number;
    latestPeriod?: string;
  }>,
  today: Date
): ProjectInsight[] {
  const activitiesByProject = new Map<string, ActivityRow[]>();
  activities.forEach((activity) => {
    const existing = activitiesByProject.get(activity.project_id) || [];
    existing.push(activity);
    activitiesByProject.set(activity.project_id, existing);
  });

  return projects.map((project) => {
    const projectActivities = activitiesByProject.get(project.id) || [];
    const progress = progressByProject.get(project.id);
    const endDate = parseDate(project.end_date);
    const daysRemaining = endDate ? Math.max(0, daysBetween(today, endDate)) : 0;
    const completedActivities = projectActivities.filter((activity) => activity.status === 'completed').length;
    const inProgressActivities = projectActivities.filter((activity) => activity.status === 'in-progress').length;
    const delayedActivities = projectActivities.filter((activity) => activity.status === 'delayed').length;
    const notStartedActivities = projectActivities.filter((activity) => activity.status === 'not-started' || !activity.status).length;
    const totalActivities = projectActivities.length;
    const actualProgress = progress?.actualProgress || 0;
    const plannedProgress = progress?.plannedProgress || 0;
    const estimatedFinishDate = estimateFinishDate(project, actualProgress, today);
    const evidenceLinks = projectActivities.flatMap((activity) =>
      parseEvidenceUrls(activity.evidence).map((url, index) => ({
        id: `${activity.id}-${index}`,
        url,
        label: getFileName(url, index),
        fileType: getFileType(url),
        projectName: project.name,
        activityCode: activity.code,
        activityName: activity.activity_name,
        activityStatus: activity.status,
      }))
    );

    const baseInsight = {
      id: project.id,
      name: project.name,
      pic: project.pic,
      status: project.status,
      category: project.category,
      location: project.location,
      startDate: project.start_date,
      endDate: project.end_date,
      budget: project.budget,
      totalActivities,
      completedActivities,
      inProgressActivities,
      delayedActivities,
      notStartedActivities,
      evidenceItems: evidenceLinks.length,
      actualProgress,
      plannedProgress,
      variance: progress?.variance || 0,
      latestPeriod: progress?.latestPeriod,
      daysRemaining,
      isOverdue: Boolean(endDate && endDate < today && project.status !== 'completed' && actualProgress < 100),
      completionRate: totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0,
      estimatedFinishDate,
      estimatedFinishLabel: estimatedFinishDate ? formatDate(estimatedFinishDate) : 'Belum cukup data progress',
      evidenceLinks,
    };

    const risk = buildRisk(project, baseInsight);
    return { ...baseInsight, ...risk };
  });
}

function buildDocumentSummary(
  documents: DocumentRow[],
  categories: DocumentCategoryRow[]
): ChatbotSnapshot['documents'] {
  const categoryById = new Map(categories.map((category) => [category.id, category.name]));
  const counts = new Map<string, number>();

  documents.forEach((document) => {
    const category = categoryById.get(document.category_id) || 'Tanpa kategori';
    counts.set(category, (counts.get(category) || 0) + 1);
  });

  const items = documents.map((document) => ({
    id: document.id,
    category: categoryById.get(document.category_id) || 'Tanpa kategori',
    noSurat: document.no_surat,
    tanggal: document.tanggal,
    deskripsi: document.deskripsi,
    jenisDokumen: document.jenis_dokumen,
    link: document.link,
    hasSoftfile: Boolean(document.has_softfile),
    hasHardfile: Boolean(document.has_hardfile),
  }));

  return {
    byCategory: Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    recent: items.slice(0, MAX_DOCUMENTS_IN_CONTEXT),
    items,
  };
}

async function loadChatbotSnapshot(): Promise<ChatbotSnapshot> {
  if (!supabase) {
    throw new Error('Supabase belum terhubung.');
  }

  const [
    projectsResult,
    activitiesResult,
    baselineResult,
    actualResult,
    documentsResult,
    categoriesResult,
    assetsResult,
  ] = await Promise.all([
    readQuery<ProjectRow>(
      supabase.from('projects').select('*').order('start_date', { ascending: false }),
      'projects'
    ),
    readQuery<ActivityRow>(
      supabase.from('activities').select('*'),
      'activities'
    ),
    readQuery<SCurveRow>(
      supabase
        .from('s_curve_baseline')
        .select('project_id, period_label, period_index, year, cumulative_baseline, period_baseline')
        .eq('period_type', 'monthly'),
      's_curve_baseline'
    ),
    readQuery<SCurveRow>(
      supabase
        .from('s_curve_actual')
        .select('project_id, period_label, period_index, year, cumulative_actual, period_actual')
        .eq('period_type', 'monthly'),
      's_curve_actual'
    ),
    readQuery<DocumentRow>(
      supabase
        .from('documents')
        .select('id, category_id, no_surat, tanggal, deskripsi, jenis_dokumen, link, has_softfile, has_hardfile, keterangan, created_at')
        .order('tanggal', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      'documents'
    ),
    readQuery<DocumentCategoryRow>(
      supabase.from('document_categories').select('id, name'),
      'document_categories'
    ),
    readQuery<ChatbotAssetRow>(
      supabase
        .from('assets')
        .select('id, file_name, file_url, storage_key, mime_type, file_size, category, description, uploaded_by, created_at, updated_at')
        .order('created_at', { ascending: false }),
      'assets'
    ),
  ]);

  const warnings = [
    projectsResult.warning,
    activitiesResult.warning,
    baselineResult.warning,
    actualResult.warning,
    documentsResult.warning,
    categoriesResult.warning,
    assetsResult.warning,
  ].filter(Boolean) as string[];

  const progressByProject = buildLatestProgress(baselineResult.data, actualResult.data);
  const today = startOfDay(new Date());
  const projects = buildProjectInsights(projectsResult.data, activitiesResult.data, progressByProject, today);
  const ongoingProjects = projects.filter((project) => project.status === 'active' || project.status === 'on-hold');
  const documentSummary = buildDocumentSummary(documentsResult.data, categoriesResult.data);
  const assetSummary = buildAssetSummary(assetsResult.data);

  return {
    generatedAt: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
    totals: {
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => project.status === 'active').length,
      onHoldProjects: projects.filter((project) => project.status === 'on-hold').length,
      completedProjects: projects.filter((project) => project.status === 'completed').length,
      cancelledProjects: projects.filter((project) => project.status === 'cancelled').length,
      ongoingProjects: ongoingProjects.length,
      delayedProjects: projects.filter((project) => project.delayedActivities > 0).length,
      atRiskProjects: projects.filter((project) => project.riskLevel === 'high' || project.riskLevel === 'medium').length,
      overdueProjects: projects.filter((project) => project.isOverdue).length,
      avgActualProgress: ongoingProjects.length > 0
        ? ongoingProjects.reduce((sum, project) => sum + project.actualProgress, 0) / ongoingProjects.length
        : 0,
      totalActivities: projects.reduce((sum, project) => sum + project.totalActivities, 0),
      totalDocuments: documentsResult.data.length,
      softfileDocuments: documentsResult.data.filter((document) => document.has_softfile).length,
      hardfileDocuments: documentsResult.data.filter((document) => document.has_hardfile).length,
      totalAssets: assetSummary.totalAssets,
      totalAssetSize: assetSummary.totalSize,
    },
    projects,
    documents: documentSummary,
    assets: assetSummary,
    warnings,
  };
}

function compactProject(project: ProjectInsight) {
  return {
    name: project.name,
    pic: project.pic,
    status: project.status,
    category: project.category || '-',
    location: project.location || '-',
    timeline: `${formatDate(project.startDate)} - ${formatDate(project.endDate)}`,
    actualProgress: `${project.actualProgress.toFixed(1)}%`,
    plannedProgress: `${project.plannedProgress.toFixed(1)}%`,
    variance: `${project.variance >= 0 ? '+' : ''}${project.variance.toFixed(1)} poin`,
    latestPeriod: project.latestPeriod || 'Belum ada data S-Curve',
    activities: {
      total: project.totalActivities,
      completed: project.completedActivities,
      inProgress: project.inProgressActivities,
      delayed: project.delayedActivities,
      notStarted: project.notStartedActivities,
    },
    daysRemaining: project.daysRemaining,
    overdue: project.isOverdue,
    riskLevel: project.riskLevel,
    riskReasons: project.riskReasons,
    estimatedFinish: project.estimatedFinishLabel,
    evidenceItems: project.evidenceItems,
  };
}

function sourceText(source: ChatbotSource): string {
  return normalizeText([
    source.title,
    source.subtitle,
    source.projectName,
    source.meta,
    source.url,
  ].filter(Boolean).join(' '));
}

function addUniqueSource(sources: ChatbotSource[], source: ChatbotSource) {
  if (!source.url || sources.some((item) => item.url === source.url)) return;
  sources.push(source);
}

function evidenceToSource(evidence: EvidenceLink): ChatbotSource {
  return {
    id: `evidence-${evidence.id}`,
    type: 'evidence',
    title: evidence.label,
    subtitle: `${evidence.projectName} • ${evidence.activityCode ? `${evidence.activityCode}. ` : ''}${evidence.activityName}`,
    url: evidence.url,
    projectName: evidence.projectName,
    meta: `${evidence.fileType.toUpperCase()} • ${statusLabel(evidence.activityStatus)}`,
  };
}

function documentToSource(document: DocumentLink): ChatbotSource | null {
  if (!document.link) return null;

  return {
    id: `document-${document.id}`,
    type: 'document',
    title: document.noSurat || document.deskripsi || document.jenisDokumen || 'Dokumen',
    subtitle: [
      document.category,
      document.tanggal ? formatDate(document.tanggal) : null,
      document.jenisDokumen,
    ].filter(Boolean).join(' • '),
    url: document.link,
    meta: `${document.hasSoftfile ? 'Softfile' : 'Tanpa softfile'}${document.hasHardfile ? ' • Hardfile' : ''}`,
  };
}

function compactAsset(asset: ChatbotAssetLink) {
  return {
    fileName: asset.fileName,
    location: asset.location,
    folder: asset.folder,
    type: asset.fileType,
    sizeBytes: asset.fileSize,
    uploadedBy: asset.uploadedBy || '-',
    createdAt: asset.createdAt || '-',
    description: asset.description || '-',
    url: asset.fileUrl,
  };
}

function scoreSource(source: ChatbotSource, tokens: string[], question: string): number {
  if (source.type === 'asset') {
    return scoreAssetSource(source, tokens, question);
  }

  const searchable = sourceText(source);
  let score = 0;

  tokens.forEach((token) => {
    if (searchable.includes(token)) score += 2;
  });

  if (/evidence|bukti|foto|lampiran|r2|pdf|file|link/i.test(question) && source.type === 'evidence') score += 3;
  if (/dokumen|surat|softfile|hardfile|pdf|link/i.test(question) && source.type === 'document') score += 3;
  if (/terlambat|delayed|risiko|overdue/i.test(question) && /terlambat|delayed/i.test(searchable)) score += 2;

  return score;
}

function buildRelevantSources(question: string, snapshot: ChatbotSnapshot): ChatbotSource[] {
  const tokens = getQuestionTokens(question);
  const normalizedQuestion = normalizeText(question);
  const selectedProject = snapshot.projects.find((project) =>
    normalizedQuestion.includes(normalizeText(project.name))
  );
  const candidates: ChatbotSource[] = [];

  if (selectedProject) {
    selectedProject.evidenceLinks.forEach((evidence) => addUniqueSource(candidates, evidenceToSource(evidence)));
  }

  const riskProjects = snapshot.projects
    .filter((project) => project.riskLevel === 'high' || project.delayedActivities > 0 || project.isOverdue)
    .sort((a, b) => b.delayedActivities - a.delayedActivities || Number(b.isOverdue) - Number(a.isOverdue));

  if (!selectedProject && /terlambat|delayed|risiko|overdue|evidence|bukti|foto|lampiran|link/i.test(question)) {
    riskProjects.forEach((project) => {
      project.evidenceLinks
        .filter((evidence) => evidence.activityStatus === 'delayed' || project.isOverdue || project.riskLevel === 'high')
        .forEach((evidence) => addUniqueSource(candidates, evidenceToSource(evidence)));
    });
  }

  snapshot.projects.forEach((project) => {
    project.evidenceLinks.forEach((evidence) => {
      const source = evidenceToSource(evidence);
      if (scoreSource(source, tokens, question) > 0) addUniqueSource(candidates, source);
    });
  });

  snapshot.documents.items.forEach((document) => {
    const source = documentToSource(document);
    if (!source) return;
    if (scoreSource(source, tokens, question) > 0 || /dokumen|surat|softfile|hardfile/i.test(question)) {
      addUniqueSource(candidates, source);
    }
  });

  snapshot.assets.items.forEach((asset) => {
    const source = assetToSource(asset);
    if (scoreSource(source, tokens, question) > 0 || /asset|aset|r2|folder|shapefile|data spasial|peta/i.test(question)) {
      addUniqueSource(candidates, source);
    }
  });

  if (candidates.length === 0 && /dokumen|surat|softfile|hardfile/i.test(question)) {
    snapshot.documents.items
      .slice(0, MAX_SOURCES_IN_UI)
      .map(documentToSource)
      .forEach((source) => source && addUniqueSource(candidates, source));
  }

  if (candidates.length === 0 && /asset|aset|r2|folder|shapefile|data spasial|peta/i.test(question)) {
    snapshot.assets.items
      .slice(0, MAX_SOURCES_IN_UI)
      .map(assetToSource)
      .forEach((source) => addUniqueSource(candidates, source));
  }

  return candidates
    .map((source) => ({ source, score: scoreSource(source, tokens, question) }))
    .sort((a, b) => b.score - a.score)
    .map(({ source }) => source)
    .slice(0, MAX_SOURCES_IN_UI);
}

function buildDataContext(snapshot: ChatbotSnapshot, sources: ChatbotSource[]): string {
  const sortedProjects = [...snapshot.projects].sort((a, b) => {
    const riskOrder: Record<RiskLevel, number> = {
      high: 0,
      medium: 1,
      unknown: 2,
      low: 3,
      completed: 4,
    };
    return riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || b.delayedActivities - a.delayedActivities;
  });

  const context = {
    generatedAt: snapshot.generatedAt,
    totals: {
      ...snapshot.totals,
      avgActualProgress: `${snapshot.totals.avgActualProgress.toFixed(1)}%`,
    },
    projectsIncluded: Math.min(sortedProjects.length, MAX_PROJECTS_IN_CONTEXT),
    projectsTotal: sortedProjects.length,
    projects: sortedProjects.slice(0, MAX_PROJECTS_IN_CONTEXT).map(compactProject),
    relevantSources: sources.slice(0, MAX_SOURCES_IN_CONTEXT).map((source) => ({
      type: source.type,
      title: source.title,
      subtitle: source.subtitle,
      meta: source.meta,
      url: source.url,
    })),
    documents: {
      byCategory: snapshot.documents.byCategory,
      recent: snapshot.documents.recent,
    },
    assets: {
      totalAssets: snapshot.assets.totalAssets,
      totalSize: snapshot.assets.totalSize,
      byLocation: snapshot.assets.byLocation,
      byFolder: snapshot.assets.byFolder.slice(0, 24),
      recent: snapshot.assets.recent.map(compactAsset),
    },
    warnings: snapshot.warnings,
  };

  return JSON.stringify(context, null, 2);
}

function findProjectFromQuestion(question: string, projects: ProjectInsight[]): ProjectInsight | undefined {
  const normalizedQuestion = question.toLowerCase();
  return projects.find((project) => normalizedQuestion.includes(project.name.toLowerCase()));
}

function buildFallbackAnswer(question: string, snapshot: ChatbotSnapshot, sources: ChatbotSource[]): string {
  const normalizedQuestion = question.toLowerCase();
  const selectedProject = findProjectFromQuestion(question, snapshot.projects);
  const asksAsset = /asset|aset|r2|folder|shapefile|data spasial|peta/i.test(question);

  if (asksAsset) {
    if (snapshot.assets.totalAssets === 0) {
      return 'Saya belum menemukan metadata asset dari data yang tersedia. Kalau file sudah diupload, kemungkinan tabel assets belum bisa dibaca oleh client atau belum ada asset yang tersimpan.';
    }

    if (sources.length === 0) {
      return `Saya membaca ${snapshot.assets.totalAssets} asset tersimpan, tetapi belum menemukan asset yang cukup cocok dengan pertanyaan itu. Coba sebutkan nama folder, lokasi, atau ekstensi file agar pencariannya lebih presisi.`;
    }

    const sampleSources = sources
      .filter((source) => source.type === 'asset')
      .slice(0, 3)
      .map((source) => `${source.title} di ${source.subtitle}`)
      .join('; ');

    return [
      `Saya menemukan ${sources.filter((source) => source.type === 'asset').length || sources.length} referensi asset yang relevan, dan link R2-nya bisa dibuka dari kartu sumber di bawah jawaban ini.`,
      `Secara total, sistem membaca ${snapshot.assets.totalAssets} asset dari ${snapshot.assets.byLocation.length} lokasi/folder utama.`,
      sampleSources ? `Contoh yang paling dekat: ${sampleSources}.` : '',
    ].filter(Boolean).join('\n');
  }

  if (/evidence|bukti|foto|lampiran|dokumen|surat|softfile|hardfile|pdf|link|file/i.test(question)) {
    if (sources.length === 0) {
      return selectedProject
        ? `Saya belum menemukan link evidence atau dokumen yang relevan untuk ${selectedProject.name} dari data yang tersedia. Kemungkinan datanya memang belum diunggah, atau belum terhubung ke aktivitas project tersebut.`
        : 'Saya belum menemukan link evidence atau dokumen yang cukup relevan dari data yang tersedia. Coba sebutkan nama project, PIC, atau jenis dokumen agar pencariannya lebih presisi.';
    }

    const sampleSources = sources
      .slice(0, 3)
      .map((source) => `${source.title} untuk ${source.subtitle}`)
      .join('; ');

    return [
      `Saya menemukan ${sources.length} referensi yang relevan, dan link-nya bisa langsung dibuka dari kartu sumber di bawah jawaban ini.`,
      selectedProject
        ? `Untuk ${selectedProject.name}, referensi yang muncul terutama terkait evidence aktivitas dan dokumen pendukung.`
        : `Saya memilihnya dari evidence aktivitas dan metadata dokumen yang paling dekat dengan pertanyaan kamu.`,
      sampleSources ? `Contoh yang paling dekat: ${sampleSources}.` : '',
    ].join('\n');
  }

  if (selectedProject && (normalizedQuestion.includes('estimasi') || normalizedQuestion.includes('selesai'))) {
    return [
      `Estimasi sederhana saya untuk ${selectedProject.name} mengarah ke ${selectedProject.estimatedFinishLabel}.`,
      `Angka ini dibaca dari progress actual ${selectedProject.actualProgress.toFixed(1)}% dibanding rencana ${selectedProject.plannedProgress.toFixed(1)}%, dengan selisih ${selectedProject.variance >= 0 ? '+' : ''}${selectedProject.variance.toFixed(1)} poin. ${selectedProject.riskReasons.length > 0 ? `Yang perlu diperhatikan: ${selectedProject.riskReasons.join('; ')}.` : 'Dari data saat ini, belum ada sinyal risiko besar yang terbaca.'}`,
    ].filter(Boolean).join('\n');
  }

  if (normalizedQuestion.includes('ongoing') || normalizedQuestion.includes('on going') || normalizedQuestion.includes('berjalan')) {
    return `Saat ini ada ${snapshot.totals.ongoingProjects} project yang masih ongoing. Komposisinya ${snapshot.totals.activeProjects} active dan ${snapshot.totals.onHoldProjects} on-hold, dengan rata-rata progress actual sekitar ${snapshot.totals.avgActualProgress.toFixed(1)}%. Secara cepat, ini berarti seluruh portfolio yang terbaca masih berada di fase berjalan dan belum ada yang masuk completed.`;
  }

  if (normalizedQuestion.includes('terlambat') || normalizedQuestion.includes('delayed') || normalizedQuestion.includes('risiko')) {
    const riskyProjects = snapshot.projects
      .filter((project) => project.riskLevel === 'high' || project.riskLevel === 'medium')
      .slice(0, 8);

    if (riskyProjects.length === 0) {
      return 'Belum ada project berisiko tinggi dari data progress dan aktivitas yang tersedia.';
    }

    const topRisks = riskyProjects
      .slice(0, 4)
      .map((project) => `${project.name} karena ${project.riskReasons.join('; ')}`)
      .join('. ');

    return [
      `Ada ${snapshot.totals.atRiskProjects} project yang perlu perhatian dari data saat ini.`,
      `Sinyal utamanya datang dari kombinasi project yang melewati end date, aktivitas delayed, dan gap antara actual versus baseline. Yang paling perlu dilihat lebih dulu: ${topRisks}.`,
      `Saya akan lebih percaya diri memberi prioritas final kalau data S-Curve dan evidence terbaru sudah lengkap di setiap aktivitas.`
    ].join('\n');
  }

  return [
    `Portfolio saat ini terbaca berisi ${snapshot.totals.totalProjects} project, dengan ${snapshot.totals.ongoingProjects} masih ongoing dan ${snapshot.totals.completedProjects} completed.`,
    `Dari sisi eksekusi, ada ${snapshot.totals.totalActivities} aktivitas tercatat. Saya melihat ${snapshot.totals.delayedProjects} project punya aktivitas delayed dan ${snapshot.totals.overdueProjects} project sudah melewati end date, jadi fokus monitoring sebaiknya diarahkan ke project yang telat sekaligus punya gap progress terbesar.`,
    `Untuk dokumen, sistem membaca ${snapshot.totals.totalDocuments} metadata dokumen, termasuk ${snapshot.totals.softfileDocuments} softfile dan ${snapshot.totals.hardfileDocuments} hardfile. Asset R2 yang terbaca berjumlah ${snapshot.totals.totalAssets} file.`
  ].join('\n');
}

export async function answerProjectQuestion(question: string): Promise<ChatbotAnswer> {
  const reportResult = await prepareReportAction(question);
  if (reportResult) {
    return {
      answer: reportResult.answer,
      usedAI: false,
      sources: reportResult.sources,
      action: reportResult.action,
    };
  }

  const snapshot = await loadChatbotSnapshot();
  const sources = buildRelevantSources(question, snapshot);

  if (!isGeminiAvailable()) {
    return {
      answer: `${buildFallbackAnswer(question, snapshot, sources)}\n\nCatatan: Gemini API key belum terdeteksi di environment browser.`,
      usedAI: false,
      sources,
    };
  }

  try {
    const answer = await generateChatbotAnswer(question, buildDataContext(snapshot, sources));
    return { answer, usedAI: true, sources };
  } catch (error) {
    const fallback = buildFallbackAnswer(question, snapshot, sources);
    const message = error instanceof Error ? error.message : 'Gemini gagal menjawab';
    return {
      answer: `${fallback}\n\nCatatan: Gemini belum berhasil dipanggil (${message}).`,
      usedAI: false,
      sources,
    };
  }
}
