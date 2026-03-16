/**
 * Gemini AI Service for generating project analysis narratives
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function getApiKey(): string {
  try {
    // @ts-ignore - Vite injects import.meta.env at build time
    return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  } catch {
    return '';
  }
}

export interface ProjectAnalysisData {
  name: string;
  pic: string;
  location: string;
  category: string;
  description: string;
  startDate: string;
  endDate: string;
  budget?: number;
  actualProgress: number;
  plannedProgress: number;
  variance: number;
  totalActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  delayedActivities: number;
  daysRemaining: number;
  completionRate: number;
}

export interface AIAnalysisResult {
  summary: string;
  progressAnalysis: string;
  risks: string;
  recommendations: string;
}

export interface PortfolioSummaryResult {
  overview: string;
  highlights: string;
  concerns: string;
  recommendations: string;
}

/**
 * Check if Gemini API is available
 */
export function isGeminiAvailable(): boolean {
  const key = getApiKey();
  console.log('[Gemini] API key available:', !!key, 'length:', key.length);
  return !!key && key.length > 10;
}

/**
 * Call Gemini API with a prompt
 */
async function callGemini(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.length < 10) {
    throw new Error('Gemini API key not configured');
  }

  console.log('[Gemini] Calling API...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
          topP: 0.9,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Gemini] API error response:', response.status, errText);
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    console.log('[Gemini] Response received, candidates:', data?.candidates?.length);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('[Gemini] Empty text in response:', JSON.stringify(data).substring(0, 500));
      throw new Error('Empty response from Gemini');
    }
    console.log('[Gemini] Got text response, length:', text.length);
    return text;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('[Gemini] Request timed out after 30s');
      throw new Error('Gemini API request timed out');
    }
    throw error;
  }
}

/**
 * Generate AI analysis for a single project
 */
export async function generateProjectAnalysis(
  project: ProjectAnalysisData
): Promise<AIAnalysisResult> {
  const budgetStr = project.budget
    ? `Rp ${(project.budget / 1_000_000).toFixed(0)} Juta`
    : 'Tidak tersedia';

  const prompt = `Kamu adalah analis senior project Pertamina Foundation yang berpengalaman. Analisis data project berikut dan berikan narasi profesional dalam Bahasa Indonesia. Gunakan bahasa formal dan ringkas.

DATA PROJECT:
- Nama: ${project.name}
- PIC: ${project.pic}
- Lokasi: ${project.location}
- Kategori: ${project.category}
- Deskripsi: ${project.description || '-'}
- Timeline: ${project.startDate} s/d ${project.endDate}
- Budget: ${budgetStr}
- Progress Realisasi: ${project.actualProgress.toFixed(1)}%
- Progress Rencana: ${project.plannedProgress.toFixed(1)}%
- Variance: ${project.variance >= 0 ? '+' : ''}${project.variance.toFixed(1)}%
- Total Activities: ${project.totalActivities}
- Selesai: ${project.completedActivities}
- Sedang Berjalan: ${project.inProgressActivities}
- Terlambat: ${project.delayedActivities}
- Sisa Hari: ${project.daysRemaining}

Berikan response dalam format EXACT berikut (gunakan delimiter ###):

###RINGKASAN###
(2-3 kalimat ringkasan kondisi project saat ini)

###ANALISIS_PROGRESS###
(2-3 kalimat analisis gap antara plan vs actual, penyebab kemungkinan)

###RISIKO###
(2-3 poin risiko utama yang perlu diwaspadai)

###REKOMENDASI###
(2-3 poin rekomendasi tindakan prioritas)`;

  try {
    const rawText = await callGemini(prompt);
    return parseAnalysisResponse(rawText);
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    console.error('Error generating project analysis:', errMsg);
    return {
      summary: `Analisis AI gagal: ${errMsg}`,
      progressAnalysis: '',
      risks: '',
      recommendations: '',
    };
  }
}

/**
 * Generate portfolio summary for all projects
 */
export async function generatePortfolioSummary(
  projects: ProjectAnalysisData[]
): Promise<PortfolioSummaryResult> {
  const projectList = projects
    .map(
      (p, i) =>
        `${i + 1}. ${p.name} | Progress: ${p.actualProgress.toFixed(1)}% (Plan: ${p.plannedProgress.toFixed(1)}%) | Variance: ${p.variance >= 0 ? '+' : ''}${p.variance.toFixed(1)}% | Selesai: ${p.completedActivities}/${p.totalActivities} | Terlambat: ${p.delayedActivities} | Sisa: ${p.daysRemaining} hari`
    )
    .join('\n');

  const avgProgress =
    projects.reduce((sum, p) => sum + p.actualProgress, 0) / projects.length;
  const totalDelayed = projects.reduce((sum, p) => sum + p.delayedActivities, 0);

  const prompt = `Kamu adalah analis senior portfolio project Pertamina Foundation. Analisis data seluruh project berikut dan berikan ringkasan portfolio dalam Bahasa Indonesia yang formal dan profesional.

RINGKASAN PORTFOLIO:
- Total Project: ${projects.length}
- Rata-rata Progress: ${avgProgress.toFixed(1)}%
- Total Activities Terlambat: ${totalDelayed}

DETAIL PER PROJECT:
${projectList}

Berikan response dalam format EXACT berikut (gunakan delimiter ###):

###OVERVIEW###
(3-4 kalimat overview kondisi portfolio secara keseluruhan)

###HIGHLIGHTS###
(2-3 poin project yang performanya baik dan alasannya)

###CONCERNS###
(2-3 poin project yang perlu perhatian khusus dan alasannya)

###REKOMENDASI###
(2-3 poin rekomendasi strategis untuk manajemen portfolio)`;

  try {
    const rawText = await callGemini(prompt);
    return parsePortfolioResponse(rawText);
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    console.error('Error generating portfolio summary:', errMsg);
    return {
      overview: `Analisis portfolio AI gagal: ${errMsg}`,
      highlights: '',
      concerns: '',
      recommendations: '',
    };
  }
}

/**
 * Parse the structured response from Gemini for project analysis
 */
function parseAnalysisResponse(text: string): AIAnalysisResult {
  const getSection = (label: string): string => {
    const regex = new RegExp(`###${label}###\\s*([\\s\\S]*?)(?=###|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    summary: getSection('RINGKASAN') || text.substring(0, 300),
    progressAnalysis: getSection('ANALISIS_PROGRESS'),
    risks: getSection('RISIKO'),
    recommendations: getSection('REKOMENDASI'),
  };
}

/**
 * Parse the structured response from Gemini for portfolio summary
 */
function parsePortfolioResponse(text: string): PortfolioSummaryResult {
  const getSection = (label: string): string => {
    const regex = new RegExp(`###${label}###\\s*([\\s\\S]*?)(?=###|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    overview: getSection('OVERVIEW') || text.substring(0, 400),
    highlights: getSection('HIGHLIGHTS'),
    concerns: getSection('CONCERNS'),
    recommendations: getSection('REKOMENDASI'),
  };
}
