import {
  assetToSource,
  buildAssetSummary,
  type ChatbotAssetRow,
  type ChatbotAssetSource,
} from './chatbotAssetUtils';
import { generateChatbotAnswer, isGeminiAvailable } from './geminiService';
import type { ChatbotSource } from './chatbotTypes';
import type { ActivityData, AssetItem, Project } from '../types';

export type ReportActionType = 'generate-weekly-project-report';

export interface ReportIntent {
  type: ReportActionType;
  projectQuery: string;
}

export interface ReportDraft {
  title: string;
  projectId: string;
  projectName: string;
  periodLabel: string;
  summary: string;
  risks: string[];
  recommendations: string[];
  activityCount: number;
  evidenceCount: number;
  relevantAssetCount: number;
}

export interface ReportAction {
  id: string;
  type: ReportActionType;
  label: string;
  confirmLabel: string;
  cancelLabel: string;
  projectId: string;
  projectName: string;
  weekStartIso: string;
  weekEndIso: string;
  draft: ReportDraft;
  assetSources: ChatbotSource[];
}

export interface ReportAgentResult {
  answer: string;
  sources: ChatbotSource[];
  action: ReportAction;
}

type ReportActivity = ActivityData & {
  id?: string;
  code?: string;
  activityName?: string;
  status?: string;
  weight?: number;
  evidence?: string[] | string | null;
};

const REPORT_TERMS = /(buat|generate|bikin|susun|siapkan).{0,40}(laporan|report|weekly report|mingguan)/i;

export function detectReportIntent(question: string): ReportIntent | null {
  if (!REPORT_TERMS.test(question)) return null;

  const cleaned = question
    .replace(REPORT_TERMS, '')
    .replace(/\b(project|proyek|untuk|minggu ini|weekly|report|laporan|mingguan)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    type: 'generate-weekly-project-report',
    projectQuery: cleaned,
  };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').trim();
}

export function findBestProject(projects: Project[], projectQuery: string): Project | null {
  const normalizedQuery = normalizeText(projectQuery);
  if (!normalizedQuery) return projects.length === 1 ? projects[0] : null;

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const scored = projects
    .map((project) => {
      const haystack = normalizeText([project.name, project.pic, project.category, project.location].filter(Boolean).join(' '));
      const score = queryTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { project, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.project || null;
}

function countEvidenceItems(activities: ReportActivity[]): number {
  return activities.reduce((sum, activity) => {
    const raw = activity.evidence;
    if (!raw) return sum;
    if (Array.isArray(raw)) return sum + raw.filter(Boolean).length;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return sum + (Array.isArray(parsed) ? parsed.filter(Boolean).length : 1);
      } catch {
        return sum + (raw.trim() ? 1 : 0);
      }
    }
    return sum;
  }, 0);
}

function assetItemToChatbotRow(asset: AssetItem): ChatbotAssetRow {
  return {
    id: asset.id,
    file_name: asset.fileName,
    file_url: asset.fileUrl,
    storage_key: asset.storageKey,
    mime_type: asset.mimeType,
    file_size: asset.fileSize,
    category: asset.category,
    description: asset.description,
    uploaded_by: asset.uploadedBy,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
  };
}

function selectRelevantAssetSources(project: Project, assets: AssetItem[]): ChatbotAssetSource[] {
  const summary = buildAssetSummary(assets.map(assetItemToChatbotRow));
  const projectTokens = normalizeText([project.name, project.location, project.category, project.pic].filter(Boolean).join(' '))
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  return summary.items
    .map((asset) => {
      const haystack = normalizeText([asset.fileName, asset.location, asset.folder, asset.category || '', asset.description || ''].join(' '));
      const score = projectTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { asset, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => assetToSource(item.asset));
}

function getWeekStart(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getWeekEnd(date: Date): Date {
  const end = new Date(getWeekStart(date));
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatPeriod(start: Date, end: Date): string {
  return `${start.toLocaleDateString('id-ID')} - ${end.toLocaleDateString('id-ID')}`;
}

function buildRuleBasedDraft(
  project: Project,
  activities: ReportActivity[],
  relevantAssetCount: number,
  periodLabel: string,
  progress: number,
): ReportDraft {
  const delayed = activities.filter((activity) => activity.status === 'delayed').length;
  const inProgress = activities.filter((activity) => activity.status === 'in-progress').length;
  const evidenceCount = countEvidenceItems(activities);

  return {
    title: `Draft Weekly Report - ${project.name}`,
    projectId: project.id,
    projectName: project.name,
    periodLabel,
    summary: `${project.name} berada pada progress ${progress.toFixed(1)}% dengan ${activities.length} aktivitas tercatat. Danta menyiapkan draft laporan mingguan ini dengan ${evidenceCount} evidence dan ${relevantAssetCount} asset R2 relevan sebagai referensi.`,
    risks: delayed > 0
      ? [`Ada ${delayed} aktivitas berstatus terlambat yang perlu diprioritaskan dalam narasi laporan.`]
      : ['Belum ada aktivitas terlambat yang terbaca dari data status saat ini.'],
    recommendations: [
      inProgress > 0
        ? `Fokuskan update minggu ini pada ${inProgress} aktivitas berjalan agar progress berikutnya bisa terukur.`
        : 'Pastikan aktivitas berikutnya memiliki target mingguan yang jelas.',
      relevantAssetCount > 0
        ? 'Lampirkan asset R2 yang relevan sebagai sumber pendukung laporan.'
        : 'Tambahkan asset R2 terkait project jika ada dokumen pendukung yang belum tercatat.',
    ],
    activityCount: activities.length,
    evidenceCount,
    relevantAssetCount,
  };
}

async function improveDraftWithAI(question: string, draft: ReportDraft): Promise<ReportDraft> {
  if (!isGeminiAvailable()) return draft;

  let answer = '';
  try {
    answer = await generateChatbotAnswer(
      `Perbaiki draft weekly report berikut menjadi ringkasan eksekutif singkat. Jangan tambah angka baru. Pertanyaan awal: ${question}`,
      JSON.stringify(draft, null, 2),
    );
  } catch (error) {
    console.warn('Danta Report Agent failed to improve draft with Gemini:', error);
    return draft;
  }

  return {
    ...draft,
    summary: answer.slice(0, 900),
  };
}

export async function prepareReportAction(question: string): Promise<ReportAgentResult | null> {
  const intent = detectReportIntent(question);
  if (!intent) return null;

  const {
    fetchActivities,
    fetchAssets,
    fetchProjectMetrics,
    fetchProjects,
    fetchSCurveData,
  } = await import('./supabase');

  const projects = await fetchProjects();
  const project = findBestProject(projects, intent.projectQuery);
  if (!project) {
    throw new Error('Saya belum bisa menentukan project untuk laporan ini. Sebutkan nama project, lokasi, atau PIC agar draft report bisa dibuat.');
  }

  const [activities, sCurveData, assets, metrics] = await Promise.all([
    fetchActivities(project.id),
    fetchSCurveData(project.id),
    fetchAssets(),
    fetchProjectMetrics(project.id),
  ]);

  const weekStart = getWeekStart(new Date());
  const weekEnd = getWeekEnd(new Date());
  const periodLabel = formatPeriod(weekStart, weekEnd);
  const assetSources = selectRelevantAssetSources(project, assets);
  const latestSCurve = sCurveData[sCurveData.length - 1];
  const progress = metrics?.overallProgress ?? latestSCurve?.actual ?? 0;
  const draft = await improveDraftWithAI(
    question,
    buildRuleBasedDraft(project, activities, assetSources.length, periodLabel, progress),
  );

  const action: ReportAction = {
    id: `report-${project.id}-${Date.now()}`,
    type: 'generate-weekly-project-report',
    label: `Generate weekly report ${project.name}`,
    confirmLabel: 'Setuju, generate PDF',
    cancelLabel: 'Batal',
    projectId: project.id,
    projectName: project.name,
    weekStartIso: weekStart.toISOString(),
    weekEndIso: weekEnd.toISOString(),
    draft,
    assetSources: assetSources as ChatbotSource[],
  };

  return {
    answer: [
      `Saya sudah menyiapkan draft weekly report untuk ${project.name}.`,
      `Periode laporan: ${periodLabel}.`,
      `Draft ini membaca ${activities.length} aktivitas, ${draft.evidenceCount} evidence, ${sCurveData.length} titik S-Curve, dan ${assetSources.length} asset R2 relevan.`,
      'Silakan review ringkasannya dulu. PDF baru akan dibuat setelah kamu konfirmasi.',
    ].join('\n'),
    sources: action.assetSources,
    action,
  };
}
