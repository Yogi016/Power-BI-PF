# Danta Report Agent R2 Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Danta.AI into a confirmed-action Report Agent that can draft improved weekly project reports, include relevant R2 asset metadata as sources, and only generate the final PDF after user confirmation.

**Architecture:** Keep the MVP client-side because the existing app already runs Gemini, Supabase reads, and PDF generation from the browser. Add a small `reportAgent` layer that detects report requests, builds a report draft from project/activity/S-Curve/asset metadata, returns a pending action to the chatbot UI, and calls the existing PDF generator only when the user confirms. R2 content extraction is intentionally out of scope for this MVP; the agent reads asset metadata and links that are already stored in Supabase.

**Tech Stack:** React, TypeScript, Vite, Supabase client helpers, existing Gemini service, existing `generateWeeklyReport`, existing R2 asset metadata helpers.

---

## File Structure

- Create: `lib/reportAgent.ts`
  - Owns report intent detection, project matching, asset relevance selection, report draft generation, and pending action shape.
- Create: `lib/chatbotTypes.ts`
  - Holds shared chatbot source/action response types so `chatbotData` and `reportAgent` do not import each other.
- Modify: `lib/chatbotData.ts`
  - Routes report-generation prompts to `reportAgent` before the generic Q&A path.
  - Extends `ChatbotAnswer` with an optional `action`.
- Modify: `components/AIChatbot.tsx`
  - Stores optional pending report actions on assistant messages.
  - Renders a confirmation card with draft summary, source counts, and buttons.
  - Calls `generateWeeklyReport` only after user clicks confirm.
- Create: `scripts/test-report-agent.ts`
  - Lightweight executable checks for report intent detection, project matching, and asset source shaping without hitting live Supabase.
- Modify: `.env.example`
  - Documents that Report Agent uses the existing Gemini key and R2 asset metadata path.

## Scope Rules

- MVP supports **weekly project report per project**.
- MVP supports **draft first, generate after confirmation**.
- MVP reads R2 asset **metadata and links** from the `assets` table.
- MVP does **not** read the inside of R2 files yet. PDF/Word/Excel extraction should be a separate backend/Worker phase.
- MVP does **not** update Supabase data. The only action is browser-side PDF generation after confirmation.

## Task 1: Add Shared Chatbot Types and Report Agent Core

**Files:**
- Create: `lib/chatbotTypes.ts`
- Create: `lib/reportAgent.ts`
- Test: `scripts/test-report-agent.ts`

- [ ] **Step 1: Create shared chatbot types**

Create `lib/chatbotTypes.ts`:

```ts
export type ChatbotSourceType = 'evidence' | 'document' | 'asset';

export interface ChatbotSource {
  id: string;
  type: ChatbotSourceType;
  title: string;
  subtitle: string;
  url: string;
  projectName?: string;
  meta?: string;
}
```

- [ ] **Step 2: Create the report agent module**

Create `lib/reportAgent.ts` with these exported types and pure helpers:

```ts
import { fetchActivities, fetchAssets, fetchProjectMetrics, fetchProjects, fetchSCurveData } from './supabase';
import { assetToSource, buildAssetSummary, type ChatbotAssetRow, type ChatbotAssetSource } from './chatbotAssetUtils';
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
}

export interface ReportAgentResult {
  answer: string;
  sources: ChatbotSource[];
  action: ReportAction;
}

const REPORT_TERMS = /(buat|generate|bikin|susun|siapkan).{0,30}(laporan|report|weekly report|mingguan)/i;

type ReportActivity = ActivityData & {
  id?: string;
  code?: string;
  activityName?: string;
  status?: string;
  weight?: number;
  evidence?: string[] | string | null;
};

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

  const scored = projects
    .map((project) => {
      const haystack = normalizeText([project.name, project.pic, project.category, project.location].filter(Boolean).join(' '));
      const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
      const score = queryTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { project, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.project || null;
}

function countEvidenceItems(activities: ReportActivity[]): number {
  return activities.reduce((sum, activity) => {
    const raw = (activity as any).evidence;
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
  const completed = activities.filter((activity) => activity.status === 'completed').length;
  const delayed = activities.filter((activity) => activity.status === 'delayed').length;
  const inProgress = activities.filter((activity) => activity.status === 'in-progress').length;
  const evidenceCount = countEvidenceItems(activities);
  return {
    title: `Draft Weekly Report - ${project.name}`,
    projectId: project.id,
    projectName: project.name,
    periodLabel,
    summary: `${project.name} berada pada progress ${progress.toFixed(1)}% dengan ${activities.length} aktivitas tercatat. Pada draft ini, Danta menyiapkan laporan mingguan dengan ${evidenceCount} evidence dan ${relevantAssetCount} asset R2 relevan sebagai referensi.`,
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

  const promptContext = JSON.stringify(draft, null, 2);
  const answer = await generateChatbotAnswer(
    `Perbaiki draft weekly report berikut menjadi ringkasan eksekutif singkat. Jangan tambah angka baru. Pertanyaan awal: ${question}`,
    promptContext,
  );

  return {
    ...draft,
    summary: answer.slice(0, 900),
  };
}

export async function prepareReportAction(question: string): Promise<ReportAgentResult | null> {
  const intent = detectReportIntent(question);
  if (!intent) return null;

  const projects = await fetchProjects();
  const project = findBestProject(projects, intent.projectQuery);
  if (!project) {
    throw new Error('Saya belum bisa menentukan project untuk laporan ini. Sebutkan nama project, lokasi, atau PIC agar draft report bisa dibuat.');
  }

  const [activities, scurveData, assetRows, metrics] = await Promise.all([
    fetchActivities(project.id),
    fetchSCurveData(project.id),
    fetchAssets(),
    fetchProjectMetrics(project.id),
  ]);

  const weekStart = getWeekStart(new Date());
  const weekEnd = getWeekEnd(new Date());
  const periodLabel = formatPeriod(weekStart, weekEnd);
  const assetSources = selectRelevantAssetSources(project, assetRows);
  const latestSCurve = scurveData[scurveData.length - 1];
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
  };

  return {
    answer: [
      `Saya sudah menyiapkan draft weekly report untuk ${project.name}.`,
      `Periode laporan: ${periodLabel}.`,
      `Draft ini membaca ${activities.length} aktivitas, ${draft.evidenceCount} evidence, ${scurveData.length} titik S-Curve, dan ${assetSources.length} asset R2 relevan.`,
      'Silakan review ringkasannya dulu. PDF baru akan dibuat setelah kamu konfirmasi.',
    ].join('\n'),
    sources: assetSources as ChatbotSource[],
    action,
  };
}
```

- [ ] **Step 3: Add the report agent smoke test**

Create `scripts/test-report-agent.ts`:

```ts
import { detectReportIntent, findBestProject } from '../lib/reportAgent';
import type { Project } from '../types';

const projects = [
  {
    id: 'p-mahakam',
    name: 'Restorasi Mahakam',
    pic: 'Ayu',
    category: 'Mahakam',
    location: 'Kalimantan Timur',
    status: 'active',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  },
  {
    id: 'p-blora',
    name: 'Program Blora Hijau',
    pic: 'Bima',
    category: 'Blora',
    location: 'Blora',
    status: 'active',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  },
] as Project[];

const intent = detectReportIntent('Danta buat laporan mingguan project Mahakam minggu ini');
if (!intent) throw new Error('Expected report intent to be detected');
if (intent.type !== 'generate-weekly-project-report') throw new Error(`Unexpected intent type ${intent.type}`);

const selected = findBestProject(projects, intent.projectQuery);
if (selected?.id !== 'p-mahakam') {
  throw new Error(`Expected p-mahakam, got ${selected?.id || 'none'}`);
}

const ignored = detectReportIntent('Project mana paling berisiko?');
if (ignored !== null) throw new Error('Risk question should not become report action');

console.log('report agent helpers ok');
```

- [ ] **Step 4: Run the smoke test**

Run:

```bash
./node_modules/.bin/tsx scripts/test-report-agent.ts
```

Expected:

```text
report agent helpers ok
```

If this fails with `listen EPERM` from `tsx`, run the Vite build in Task 5 and note that the sandbox blocks `tsx` IPC. Do not treat the report agent code as broken from that IPC error alone.

## Task 2: Route Chatbot Report Requests to the Agent

**Files:**
- Modify: `lib/chatbotTypes.ts`
- Modify: `lib/chatbotData.ts`

- [ ] **Step 1: Move `ChatbotSource` to shared types**

In `lib/chatbotData.ts`, remove the local `SourceType` alias and `ChatbotSource` interface:

```ts
type SourceType = 'evidence' | 'document' | 'asset';

export interface ChatbotSource {
  id: string;
  type: SourceType;
  title: string;
  subtitle: string;
  url: string;
  projectName?: string;
  meta?: string;
}
```

Replace them with:

```ts
import type { ChatbotSource } from './chatbotTypes';
```

- [ ] **Step 2: Extend the answer type**

In `lib/chatbotData.ts`, import the action type:

```ts
import { prepareReportAction, type ReportAction } from './reportAgent';
```

Update `ChatbotAnswer`:

```ts
export interface ChatbotAnswer {
  answer: string;
  usedAI: boolean;
  sources: ChatbotSource[];
  action?: ReportAction;
}
```

- [ ] **Step 3: Route report requests before generic snapshot Q&A**

At the top of `answerProjectQuestion(question: string)`, before `loadChatbotSnapshot()`, add:

```ts
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
```

- [ ] **Step 4: Run build to catch import cycles and type errors**

Run:

```bash
./node_modules/.bin/vite build
```

Expected:

```text
✓ built in
```

Expected result: no import cycle between `chatbotData.ts` and `reportAgent.ts` because both files import `ChatbotSource` from `lib/chatbotTypes.ts`.

## Task 3: Add Confirmation UI to Danta.AI

**Files:**
- Modify: `components/AIChatbot.tsx`

- [ ] **Step 1: Import the report action type and PDF generator**

Add:

```ts
import type { ReportAction } from '../lib/reportAgent';
import { generateWeeklyReport } from '../lib/weeklyReportUtils';
```

Update `ChatMessage`:

```ts
interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  usedAI?: boolean;
  sources?: ChatbotSource[];
  action?: ReportAction;
  actionStatus?: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
}
```

- [ ] **Step 2: Store actions returned from the chatbot**

Inside the assistant message appended after `answerProjectQuestion(trimmed)`, add:

```ts
action: response.action,
actionStatus: response.action ? 'pending' : undefined,
```

- [ ] **Step 3: Add action status updater**

Inside `AIChatbot`, add:

```ts
const updateActionStatus = (
  messageId: string,
  actionStatus: ChatMessage['actionStatus'],
  content?: string,
) => {
  setMessages((current) => current.map((message) => (
    message.id === messageId
      ? { ...message, actionStatus, content: content || message.content }
      : message
  )));
};
```

- [ ] **Step 4: Add confirm and cancel handlers**

Inside `AIChatbot`, add:

```ts
const confirmReportAction = async (messageId: string, action: ReportAction) => {
  updateActionStatus(messageId, 'running', `${action.draft.summary}\n\nSedang membuat PDF report...`);
  try {
    await generateWeeklyReport(
      action.projectId,
      new Date(action.weekStartIso),
      new Date(action.weekEndIso),
    );
    updateActionStatus(messageId, 'completed', `${action.draft.summary}\n\nPDF report untuk ${action.projectName} sudah dibuat.`);
  } catch (error) {
    updateActionStatus(
      messageId,
      'failed',
      error instanceof Error ? error.message : 'Gagal membuat PDF report.',
    );
  }
};

const cancelReportAction = (messageId: string, action: ReportAction) => {
  updateActionStatus(messageId, 'cancelled', `Draft report untuk ${action.projectName} dibatalkan. Tidak ada PDF yang dibuat.`);
};
```

- [ ] **Step 5: Render the confirmation card**

Add this component above `AIChatbot`:

```tsx
const ReportActionCard: React.FC<{
  messageId: string;
  action: ReportAction;
  status?: ChatMessage['actionStatus'];
  onConfirm: (messageId: string, action: ReportAction) => void;
  onCancel: (messageId: string, action: ReportAction) => void;
}> = ({ messageId, action, status = 'pending', onConfirm, onCancel }) => {
  const disabled = status !== 'pending';
  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-slate-700">
      <p className="font-black text-emerald-900">{action.draft.title}</p>
      <p className="mt-1 text-slate-600">Periode: {action.draft.periodLabel}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-md bg-white px-2 py-1.5">
          <p className="font-black text-slate-900">{action.draft.activityCount}</p>
          <p className="text-[10px] text-slate-500">Aktivitas</p>
        </div>
        <div className="rounded-md bg-white px-2 py-1.5">
          <p className="font-black text-slate-900">{action.draft.evidenceCount}</p>
          <p className="text-[10px] text-slate-500">Evidence</p>
        </div>
        <div className="rounded-md bg-white px-2 py-1.5">
          <p className="font-black text-slate-900">{action.draft.relevantAssetCount}</p>
          <p className="text-[10px] text-slate-500">Asset R2</p>
        </div>
      </div>
      {action.draft.risks.length > 0 && (
        <p className="mt-2 text-slate-600">Risiko utama: {action.draft.risks[0]}</p>
      )}
      {action.draft.recommendations.length > 0 && (
        <p className="mt-1 text-slate-600">Rekomendasi: {action.draft.recommendations[0]}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onConfirm(messageId, action)}
          className="rounded-md bg-emerald-600 px-3 py-1.5 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {status === 'running' ? 'Membuat PDF...' : action.confirmLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onCancel(messageId, action)}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action.cancelLabel}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Show the card under assistant messages**

In the assistant message render block, after `<SourceCards />`, add:

```tsx
{!isUser && message.action && (
  <ReportActionCard
    messageId={message.id}
    action={message.action}
    status={message.actionStatus}
    onConfirm={(messageId, action) => void confirmReportAction(messageId, action)}
    onCancel={cancelReportAction}
  />
)}
```

## Task 4: Improve Suggested Prompts for Report Agent

**Files:**
- Modify: `components/AIChatbot.tsx`

- [ ] **Step 1: Replace one generic suggestion with report action prompt**

Update `suggestedPrompts`:

```ts
const suggestedPrompts = useMemo(() => [
  'Buat laporan mingguan project Mahakam',
  'Project mana paling berisiko?',
  'Kasih evidence project terlambat',
  'Asset R2 apa yang relevan?',
  'Ringkas portfolio hari ini',
], []);
```

- [ ] **Step 2: Update placeholder text**

Change the textarea placeholder to mention reports:

```tsx
placeholder={isListening ? 'Mendengarkan...' : 'Tanya project, laporan, asset R2, evidence...'}
```

## Task 5: Verification

**Files:**
- Test: `scripts/test-report-agent.ts`
- Verify: full app build

- [ ] **Step 1: Run report helper test**

Run:

```bash
./node_modules/.bin/tsx scripts/test-report-agent.ts
```

Expected:

```text
report agent helpers ok
```

- [ ] **Step 2: Run build without the prebuild side effect**

Run:

```bash
./node_modules/.bin/vite build
```

Expected:

```text
✓ built in
```

- [ ] **Step 3: Manual browser verification**

Run:

```bash
npm run dev
```

Open the Vite URL. In Danta.AI, ask:

```text
Buat laporan mingguan project Mahakam
```

Expected UI behavior:

- Danta returns a draft, not an immediate PDF.
- The card shows activity, evidence, and asset R2 counts.
- Source cards show relevant R2 assets when matching assets exist.
- Clicking `Batal` does not generate a PDF.
- Asking again and clicking `Setuju, generate PDF` calls the existing weekly report generator.

## Task 6: Documentation

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document Report Agent environment behavior**

Add this note below the Gemini environment lines:

```dotenv
# Danta Report Agent
# Uses VITE_GEMINI_API_KEY when available to improve draft narratives.
# R2 assets are read from Supabase assets metadata; R2 secret credentials must stay server-side/Worker-side.
```

- [ ] **Step 2: Re-run build**

Run:

```bash
./node_modules/.bin/vite build
```

Expected:

```text
✓ built in
```

## Follow-Up Phase: R2 Content Reading

After this MVP is verified, implement a separate backend-safe extraction phase:

- Add a Worker/API route that downloads selected R2 objects without exposing R2 credentials to the browser.
- Extract text from PDF, DOCX, XLSX, CSV, and TXT.
- Store extracted text and hashes in a Supabase table such as `asset_text_index`.
- Let Report Agent retrieve excerpts from `asset_text_index` for richer report drafts.
- Keep file-content reading behind size limits, MIME allowlists, and audit logs.

## Self-Review

- Spec coverage: The plan covers report intent detection, R2 asset metadata reading, draft generation, confirmation UI, PDF generation after confirmation, testing, build verification, and docs.
- Placeholder scan: No `TBD`, `TODO`, or open-ended implementation placeholders remain.
- Type consistency: `ReportAction`, `ReportDraft`, `ChatbotSource`, and `ChatbotAnswer.action` are consistently named across `chatbotTypes`, `reportAgent`, `chatbotData`, and `AIChatbot`.
