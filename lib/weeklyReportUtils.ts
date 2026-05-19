import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { fetchActivities, fetchSCurveData } from './supabase';
import { formatBudgetJuta } from '../utils/formatters';

// Page dimensions for A4 Landscape (PowerPoint style)
const PAGE_WIDTH = 297; // mm
const PAGE_HEIGHT = 210; // mm
const MARGIN = 20; // mm
const REPORT_CONTENT_BOTTOM = PAGE_HEIGHT - 22; // keep body content above footer/date

// Colors
const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#8b5cf6',
  warning: '#f59e0b',
  danger: '#ef4444',
  gray: '#64748b',
  lightGray: '#f1f5f9',
};

interface WeeklyMetrics {
  totalActivities: number;
  completedThisWeek: number;
  inProgress: number;
  delayed: number;
  notStarted: number;
  onHold: number;
  overallProgress: number;
  status: 'on-track' | 'at-risk' | 'delayed';
}

const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  'completed': 'Selesai',
  'in-progress': 'Berjalan',
  'delayed': 'Terlambat',
  'not-started': 'Belum Mulai',
  'on-hold': 'Ditunda',
};

const ACTIVITY_STATUS_COLORS: Record<string, [number, number, number]> = {
  'completed': [16, 185, 129],
  'in-progress': [59, 130, 246],
  'delayed': [239, 68, 68],
  'not-started': [148, 163, 184],
  'on-hold': [245, 158, 11],
};

function getActivityStatusLabel(status?: string): string {
  return ACTIVITY_STATUS_LABELS[status || 'not-started'] || status || '-';
}

function getActivityStatusColor(status?: string): [number, number, number] {
  return ACTIVITY_STATUS_COLORS[status || 'not-started'] || ACTIVITY_STATUS_COLORS['not-started'];
}

function formatDateValue(value?: string | Date | null): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : formatDate(date);
}

function countEvidenceItems(activities: any[]): number {
  return activities.reduce((sum, activity) => sum + parseEvidenceField(activity.evidence).filter(Boolean).length, 0);
}

function getTotalWeight(activities: any[], predicate: (activity: any) => boolean = () => true): number {
  return activities
    .filter(predicate)
    .reduce((sum, activity) => sum + Number(activity.weight || 0), 0);
}

/**
 * Main function to generate weekly progress report PDF
 */
export async function generateWeeklyReport(
  projectId: string,
  weekStart?: Date,
  weekEnd?: Date
): Promise<void> {
  try {
    console.log('Starting report generation for project:', projectId);

    // Set default week range (current week)
    const start = weekStart || getWeekStart(new Date());
    const end = weekEnd || getWeekEnd(new Date());

    console.log('Week range:', start, 'to', end);

    // Fetch data - use fetchProjects and find the specific project
    const { fetchProjects: getProjects } = await import('./supabase');
    const allProjects = await getProjects();
    const project = allProjects.find(p => p.id === projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    console.log('Project loaded:', project.name);

    const activities = await fetchActivities(projectId);
    console.log('Activities loaded:', activities.length);

    const scurveData = await fetchSCurveData(projectId);
    console.log('S-Curve data loaded:', scurveData.length);

    // Calculate metrics
    const metrics = calculateWeeklyMetrics(activities, start, end);
    console.log('Metrics calculated:', metrics);

    // Create PDF
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    console.log('PDF document created');

    // Generate slides
    await createCoverSlide(doc, project, start, end);
    doc.addPage();

    await createExecutiveSummary(doc, project, metrics, activities, start, end);
    doc.addPage();

    await createSCurveSlide(doc, scurveData);
    doc.addPage();

    await createStatusBreakdown(doc, activities);
    doc.addPage();

    await createActivitySnapshot(doc, activities, start, end);

    // Evidence slide(s) — auto-paginated
    await createEvidenceSlides(doc, activities);

    doc.addPage();
    await createClosingSlide(doc, project, metrics);

    console.log('All slides generated');

    // Save PDF
    const fileName = `Weekly_Report_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${formatDate(start)}.pdf`;
    console.log('Saving PDF as:', fileName);

    doc.save(fileName);

    console.log('PDF saved successfully');
  } catch (error) {
    console.error('Error generating weekly report:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

/**
 * Slide 1: Cover Slide
 */
async function createCoverSlide(
  doc: jsPDF,
  project: any,
  weekStart: Date,
  weekEnd: Date
): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Background gradient (simulated with rectangles)
  doc.setFillColor(59, 130, 246); // Blue
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Decorative circle (without opacity)
  doc.setFillColor(16, 185, 129); // Emerald
  doc.circle(pageWidth - 50, 50, 80, 'F');

  // Add logo if available
  try {
    // Try to load logo from public folder
    const logoImg = new Image();
    logoImg.src = '/logo_putih.png';
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve;
      logoImg.onerror = reject;
      setTimeout(reject, 1000); // Timeout after 1s
    });

    // Calculate aspect ratio and maintain proportions
    const maxLogoHeight = 20; // Reduced from 30 to 20mm
    const aspectRatio = logoImg.width / logoImg.height;
    const logoHeight = maxLogoHeight;
    const logoWidth = logoHeight * aspectRatio;

    // Add logo to PDF (top left) with proper aspect ratio
    doc.addImage(logoImg, 'PNG', MARGIN, MARGIN, logoWidth, logoHeight);
  } catch (error) {
    console.log('Logo not found, skipping');
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(40);
  doc.setFont('helvetica', 'bold');
  doc.text('Weekly Progress Report', pageWidth / 2, 70, { align: 'center' });

  // Project name box
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth / 2 - 80, 85, 160, 30, 3, 3, 'F');

  doc.setTextColor(59, 130, 246);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(project.name, pageWidth / 2, 100, { align: 'center' });

  // Project details
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`PIC: ${project.pic || 'N/A'}`, pageWidth / 2, 110, { align: 'center' });

  // Week period box
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const weekText = `Periode: ${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
  doc.text(weekText, pageWidth / 2, 130, { align: 'center' });

  // Generated date
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dibuat: ${formatDate(new Date())}`, pageWidth / 2, 145, { align: 'center' });

  // Footer
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Pertamina Foundation', pageWidth / 2, pageHeight - 20, { align: 'center' });
}

/**
 * Slide 2: Executive Summary
 */
async function createExecutiveSummary(
  doc: jsPDF,
  project: any,
  metrics: WeeklyMetrics,
  activities: any[],
  weekStart: Date,
  weekEnd: Date
): Promise<void> {
  addSlideHeader(doc, 'Executive Summary', 2);

  const statusColor = metrics.status === 'on-track' ? [16, 185, 129] : metrics.status === 'at-risk' ? [245, 158, 11] : [239, 68, 68];
  const statusText = metrics.status === 'on-track' ? 'On Track' : metrics.status === 'at-risk' ? 'At Risk' : 'Delayed';
  const evidenceCount = countEvidenceItems(activities);
  const completedCount = activities.filter(a => a.status === 'completed').length;
  const completedWeight = getTotalWeight(activities, a => a.status === 'completed');
  const activeWeight = getTotalWeight(activities, a => a.status === 'in-progress');
  const totalWeight = getTotalWeight(activities);
  const budgetText = project.budget ? formatBudgetJuta(project.budget) : '-';
  const timelineText = `${formatDateValue(project.startDate)} - ${formatDateValue(project.endDate)}`;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, 44, PAGE_WIDTH - 2 * MARGIN, 18, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(project.name || 'Project', MARGIN + 5, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`PIC: ${project.pic || '-'}  |  Periode report: ${formatDate(weekStart)} - ${formatDate(weekEnd)}`, MARGIN + 5, 58);

  const cardGap = 4;
  const cardW = (PAGE_WIDTH - 2 * MARGIN - cardGap * 3) / 4;
  const cardH = 26;
  const cards = [
    { label: 'Overall Progress', value: `${metrics.overallProgress.toFixed(1)}%`, sub: `${completedCount}/${metrics.totalActivities} activity selesai`, color: [59, 130, 246] },
    { label: 'Status Project', value: statusText, sub: metrics.delayed > 0 ? `${metrics.delayed} activity terlambat` : 'Tidak ada delay', color: statusColor },
    { label: 'Bobot Selesai', value: `${completedWeight.toFixed(1)}%`, sub: `Total bobot: ${totalWeight.toFixed(1)}%`, color: [16, 185, 129] },
    { label: 'Evidence', value: `${evidenceCount}`, sub: 'file/foto/dokumen', color: [139, 92, 246] },
    { label: 'In Progress', value: `${metrics.inProgress}`, sub: `${activeWeight.toFixed(1)}% bobot berjalan`, color: [59, 130, 246] },
    { label: 'Not Started', value: `${metrics.notStarted}`, sub: 'belum dimulai', color: [148, 163, 184] },
    { label: 'Budget', value: budgetText, sub: project.category || 'Kategori belum diisi', color: [245, 158, 11] },
    { label: 'Timeline', value: project.location || '-', sub: timelineText, color: [20, 184, 166] },
  ];

  cards.forEach((card, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = MARGIN + col * (cardW + cardGap);
    const y = 70 + row * (cardH + 5);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');
    doc.setFillColor(card.color[0], card.color[1], card.color[2]);
    doc.rect(x, y, 2.5, cardH, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 6, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(String(card.value).length > 12 ? 10 : 13);
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    const valueLine = doc.splitTextToSize(String(card.value), cardW - 10)[0] || String(card.value);
    doc.text(valueLine, x + 6, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const subLine = doc.splitTextToSize(card.sub, cardW - 10)[0] || card.sub;
    doc.text(subLine, x + 6, y + 22);
  });

  const yPos = 136;
  const barWidth = PAGE_WIDTH - 2 * MARGIN;
  const barHeight = 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Progress Portfolio Project', MARGIN, yPos);
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(MARGIN, yPos + 5, barWidth, barHeight, 2, 2, 'F');
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(MARGIN, yPos + 5, Math.min(barWidth, (metrics.overallProgress / 100) * barWidth), barHeight, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('0%', MARGIN, yPos + 19);
  doc.text('100%', MARGIN + barWidth, yPos + 19, { align: 'right' });

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(MARGIN, 162, PAGE_WIDTH - 2 * MARGIN, 24, 3, 3, 'F');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Catatan ringkas', MARGIN + 5, 170);

  doc.setFont('helvetica', 'normal');
  const summaryText = `${project.name} berada pada ${metrics.overallProgress.toFixed(1)}% progress dengan ${completedCount} activity selesai, ${metrics.inProgress} berjalan, ${metrics.notStarted} belum mulai, dan ${metrics.delayed} terlambat. Evidence tersedia sebanyak ${evidenceCount} file untuk mendukung pemeriksaan progress.`;
  const splitText = doc.splitTextToSize(summaryText, PAGE_WIDTH - 2 * MARGIN - 10);
  doc.text(splitText.slice(0, 2), MARGIN + 5, 177);

  addSlideFooter(doc, 2);
}

/**
 * Slide 3: S-Curve Progress
 */
async function createSCurveSlide(doc: jsPDF, scurveData: any): Promise<void> {
  addSlideHeader(doc, 'S-Curve Progress', 3);

  // Create canvas for chart
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  if (ctx && scurveData && scurveData.length > 0) {
    // Draw S-Curve chart
    drawSCurveChart(ctx, scurveData);

    // Convert to image and add to PDF
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', MARGIN, 50, PAGE_WIDTH - 2 * MARGIN, 120);
  } else {
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('No S-Curve data available', PAGE_WIDTH / 2, 100, { align: 'center' });
  }

  addSlideFooter(doc, 3);
}

/**
 * Slide 4: Status Breakdown
 */
async function createStatusBreakdown(doc: jsPDF, activities: any[]): Promise<void> {
  addSlideHeader(doc, 'Progress by Status', 4);

  const statusCounts = {
    'not-started': 0,
    'in-progress': 0,
    'completed': 0,
    'delayed': 0,
    'on-hold': 0,
  };

  activities.forEach(activity => {
    const status = activity.status || 'not-started';
    if (status in statusCounts) {
      statusCounts[status as keyof typeof statusCounts]++;
    }
  });

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const evidenceCount = countEvidenceItems(activities);
  const completedWeight = getTotalWeight(activities, a => a.status === 'completed');
  const delayedWeight = getTotalWeight(activities, a => a.status === 'delayed');

  const insightCards = [
    { label: 'Total Activity', value: String(total), color: [59, 130, 246] },
    { label: 'Bobot Selesai', value: `${completedWeight.toFixed(1)}%`, color: [16, 185, 129] },
    { label: 'Bobot Delay', value: `${delayedWeight.toFixed(1)}%`, color: [239, 68, 68] },
    { label: 'Evidence', value: String(evidenceCount), color: [139, 92, 246] },
  ];

  const cardW = 55;
  insightCards.forEach((card, index) => {
    const x = MARGIN + index * (cardW + 4);
    const y = 44;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardW, 22, 2, 2, 'FD');
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 4, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.text(card.value, x + 4, y + 16);
  });

  // Draw pie chart
  const centerX = 62;
  const centerY = 111;
  const radius = 34;
  let startAngle = -90;

  const statusColors: Record<string, string> = {
    'not-started': '#94a3b8',
    'in-progress': '#3b82f6',
    'completed': '#10b981',
    'delayed': '#ef4444',
    'on-hold': '#f59e0b',
  };

  Object.entries(statusCounts).forEach(([status, count]) => {
    if (count > 0 && total > 0) {
      const percentage = (count / total) * 100;
      const angle = (percentage / 100) * 360;

      doc.setFillColor(statusColors[status]);
      drawPieSlice(doc, centerX, centerY, radius, startAngle, startAngle + angle);

      startAngle += angle;
    }
  });

  doc.setFillColor(255, 255, 255);
  doc.circle(centerX, centerY, 17, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(total), centerX, centerY - 1, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('activity', centerX, centerY + 6, { align: 'center' });

  let legendY = 82;
  const legendX = 115;
  Object.entries(statusCounts).forEach(([status, count]) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    const color = getActivityStatusColor(status);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(legendX, legendY - 6, 72, 10, 1.5, 1.5, 'FD');
    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(legendX + 5, legendY - 1, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(getActivityStatusLabel(status), legendX + 10, legendY + 1);
    doc.setFont('helvetica', 'bold');
    doc.text(`${count} (${percentage.toFixed(0)}%)`, legendX + 68, legendY + 1, { align: 'right' });
    legendY += 12;
  });

  const tableData = activities.map(a => [
    a.code || '-',
    a.activityName || a.activity || '-',
    getActivityStatusLabel(a.status),
    `${Number(a.weight || 0).toFixed(1)}%`,
    String(parseEvidenceField(a.evidence).filter(Boolean).length),
  ]);
  createTable(doc, ['Code', 'Activity', 'Status', 'Bobot', 'Evidence'], tableData, MARGIN, 148, {
    rowHeight: 6.5,
    fontSize: 7,
    headerFontSize: 7.5,
    maxY: REPORT_CONTENT_BOTTOM,
  });

  addSlideFooter(doc, 4);
}

/**
 * Slide 5: Activity Snapshot
 */
async function createActivitySnapshot(
  doc: jsPDF,
  activities: any[],
  weekStart: Date,
  weekEnd: Date
): Promise<void> {
  addSlideHeader(doc, 'Activity Snapshot', 5);

  const completedThisWeek = activities.filter(a => {
    if (a.status !== 'completed' || !a.endDate) return false;
    const endDate = new Date(a.endDate);
    return endDate >= weekStart && endDate <= weekEnd;
  }).length;

  const snapshotCards = [
    { label: 'Selesai Minggu Ini', value: String(completedThisWeek), color: [16, 185, 129] },
    { label: 'Sedang Berjalan', value: String(activities.filter(a => a.status === 'in-progress').length), color: [59, 130, 246] },
    { label: 'Terlambat', value: String(activities.filter(a => a.status === 'delayed').length), color: [239, 68, 68] },
    { label: 'Belum Mulai', value: String(activities.filter(a => a.status === 'not-started').length), color: [148, 163, 184] },
    { label: 'Total Evidence', value: String(countEvidenceItems(activities)), color: [139, 92, 246] },
  ];

  const cardW = (PAGE_WIDTH - 2 * MARGIN - 16) / 5;
  snapshotCards.forEach((card, index) => {
    const x = MARGIN + index * (cardW + 4);
    const y = 44;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardW, 22, 2, 2, 'FD');
    doc.setFillColor(card.color[0], card.color[1], card.color[2]);
    doc.rect(x, y, 2, 22, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 5, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.text(card.value, x + 5, y + 17);
  });

  if (activities.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('Belum ada activity', PAGE_WIDTH / 2, 110, { align: 'center' });
    addSlideFooter(doc, 5);
    return;
  }

  const sortedActivities = [...activities].sort((a, b) => {
    const order: Record<string, number> = { delayed: 0, 'in-progress': 1, completed: 2, 'not-started': 3, 'on-hold': 4 };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  const tableData = sortedActivities.map(a => [
    a.code || '-',
    a.activityName || a.activity || '-',
    getActivityStatusLabel(a.status),
    formatDateValue(a.startDate),
    formatDateValue(a.endDate),
    `${Number(a.weight || 0).toFixed(1)}%`,
  ]);

  createTable(doc,
    ['Code', 'Activity', 'Status', 'Mulai', 'Selesai', 'Bobot'],
    tableData,
    MARGIN,
    76,
    {
      rowHeight: 6.8,
      fontSize: 7,
      headerFontSize: 7.5,
      maxY: REPORT_CONTENT_BOTTOM,
    }
  );

  addSlideFooter(doc, 5);
}

/**
 * Closing Slide
 */
async function createClosingSlide(doc: jsPDF, project: any, metrics: WeeklyMetrics): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Background
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank You', pageWidth / 2, 80, { align: 'center' });

  // Summary
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  const summary = `Project ${project.name} is ${metrics.overallProgress.toFixed(1)}% complete`;
  doc.text(summary, pageWidth / 2, 100, { align: 'center' });

  // Contact
  doc.setFontSize(14);
  doc.text('For questions, please contact:', pageWidth / 2, 130, { align: 'center' });
  doc.text(project.pic || 'Project Manager', pageWidth / 2, 145, { align: 'center' });

  // Footer
  doc.setFontSize(12);
  doc.text('Pertamina Foundation', pageWidth / 2, pageHeight - 20, { align: 'center' });
}

// =====================================================
// EVIDENCE SLIDE(S)
// =====================================================

type EvidenceFileType = 'image' | 'pdf' | 'file';

interface EvidencePreviewItem {
  url: string;
  type: EvidenceFileType;
  dataUrl?: string;
  width?: number;
  height?: number;
}

/**
 * Helper to load an image from a URL and return as HTMLImageElement
 */
async function loadImageFromUrl(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('Failed to load evidence image:', url);
      resolve(null);
    };
    // Timeout after 10s
    setTimeout(() => resolve(null), 10000);
    img.src = url;
  });
}

/**
 * Parse evidence field — can be JSON array string or plain array
 */
function parseEvidenceField(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return typeof raw === 'string' && raw.trim() ? [raw.trim()] : [];
  }
}

/**
 * Check if a URL points to an image file (not PDF or other docs)
 */
function isImageUrl(url: string): boolean {
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
  const lower = url.toLowerCase().split('?')[0]; // Remove query params
  return imageExts.some(ext => lower.endsWith(ext));
}

function isPdfUrl(url: string): boolean {
  return url.toLowerCase().split(/[?#]/)[0].endsWith('.pdf');
}

function getEvidenceFileType(url: string): EvidenceFileType {
  if (isImageUrl(url)) return 'image';
  if (isPdfUrl(url)) return 'pdf';
  return 'file';
}

async function loadImagePreview(url: string): Promise<Pick<EvidencePreviewItem, 'dataUrl' | 'width' | 'height'> | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = window.setTimeout(() => resolve(null), 10000);

    img.onload = () => {
      window.clearTimeout(timeout);
      try {
        const maxSide = 620;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.86),
          width: canvas.width,
          height: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timeout);
      resolve(null);
    };

    img.src = url;
  });
}

async function loadPdfCoverPreview(url: string): Promise<Pick<EvidencePreviewItem, 'dataUrl' | 'width' | 'height'> | null> {
  let pdf: any = null;
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

    const loadingTask = pdfjsLib.getDocument({ url });
    pdf = await new Promise<any>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        void loadingTask.destroy();
        reject(new Error('PDF evidence preview timed out'));
      }, 12000);

      loadingTask.promise
        .then((value) => {
          window.clearTimeout(timeout);
          resolve(value);
        })
        .catch((error) => {
          window.clearTimeout(timeout);
          reject(error);
        });
    });

    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1, 620 / Math.max(baseViewport.width, baseViewport.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await (page as any).render({ canvasContext: ctx, viewport }).promise;
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.86),
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    console.warn('Failed to render PDF evidence cover:', url, error);
    return null;
  } finally {
    if (pdf) {
      void pdf.destroy();
    }
  }
}

async function buildEvidencePreviewItem(url: string): Promise<EvidencePreviewItem> {
  const type = getEvidenceFileType(url);
  const preview = type === 'pdf'
    ? await loadPdfCoverPreview(url)
    : type === 'image'
      ? await loadImagePreview(url)
      : null;

  return {
    url,
    type,
    ...(preview || {}),
  };
}

function drawEvidenceFallback(doc: jsPDF, item: EvidencePreviewItem, x: number, y: number, w: number, h: number): void {
  const isPdf = item.type === 'pdf';
  doc.setFillColor(isPdf ? 254 : 248, isPdf ? 242 : 250, isPdf ? 242 : 252);
  doc.setDrawColor(isPdf ? 248 : 203, isPdf ? 113 : 213, isPdf ? 113 : 225);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(isPdf ? 220 : 71, isPdf ? 38 : 85, isPdf ? 38 : 105);
  doc.text(isPdf ? 'PDF' : 'FILE', x + w / 2, y + h / 2 + 2, { align: 'center' });
}

function drawEvidenceCard(doc: jsPDF, item: EvidencePreviewItem, x: number, y: number, w: number, h: number): void {
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

  if (item.dataUrl && item.width && item.height) {
    const pad = 2;
    const maxW = w - 2 * pad;
    const maxH = h - 2 * pad;
    const aspect = item.width / item.height;
    let dW = maxW;
    let dH = dW / aspect;
    if (dH > maxH) {
      dH = maxH;
      dW = dH * aspect;
    }

    try {
      doc.addImage(item.dataUrl, 'JPEG', x + (w - dW) / 2, y + (h - dH) / 2, dW, dH);
    } catch {
      drawEvidenceFallback(doc, item, x, y, w, h);
    }
  } else {
    drawEvidenceFallback(doc, item, x, y, w, h);
  }

  if (item.type === 'pdf') {
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(x + 2, y + 2, 11, 5.5, 1, 1, 'F');
    doc.setFontSize(5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PDF', x + 7.5, y + 5.8, { align: 'center' });
  }

  doc.link(x, y, w, h, { url: item.url });
}

/**
 * Create evidence slides — grouped by activity, compact layout
 * Multiple activities pack onto one page to save space.
 */
async function createEvidenceSlides(doc: jsPDF, activities: any[]): Promise<void> {
  interface EvidenceGridItem {
    code: string;
    name: string;
    status: string;
    item: EvidencePreviewItem;
  }

  const evidenceItems: EvidenceGridItem[] = [];
  for (const activity of activities) {
    const allUrls = parseEvidenceField(activity.evidence).filter(Boolean);
    if (allUrls.length > 0) {
      const previews = await Promise.all(allUrls.map((url) => buildEvidencePreviewItem(url)));
      previews.forEach((item) => {
        evidenceItems.push({
          code: activity.code || '',
          name: activity.activityName || activity.activity || 'Unknown',
          status: activity.status || 'not-started',
          item,
        });
      });
    }
  }

  if (evidenceItems.length === 0) {
    doc.addPage();
    addSlideHeader(doc, 'Dokumentasi Evidence', 6);
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('Belum ada evidence kegiatan', PAGE_WIDTH / 2, 100, { align: 'center' });
    addSlideFooter(doc, 6);
    return;
  }

  const CONTENT_LEFT = MARGIN;
  const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
  const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
  const CONTENT_TOP = 43;
  const CONTENT_BOTTOM = PAGE_HEIGHT - 16;
  const GRID_COLUMNS = 3;
  const GRID_ROWS = 2;
  const ITEMS_PER_PAGE = GRID_COLUMNS * GRID_ROWS;
  const CARD_GAP_X = 5;
  const CARD_GAP_Y = 6;
  const CARD_W = (CONTENT_WIDTH - (GRID_COLUMNS - 1) * CARD_GAP_X) / GRID_COLUMNS;
  const CARD_H = (CONTENT_BOTTOM - CONTENT_TOP - (GRID_ROWS - 1) * CARD_GAP_Y) / GRID_ROWS;
  const CARD_HEADER_H = 12;

  const statusColors: Record<string, [number, number, number]> = {
    'completed': [34, 197, 94],
    'in-progress': [59, 130, 246],
    'delayed': [239, 68, 68],
    'not-started': [148, 163, 184],
    'on-hold': [245, 158, 11],
  };

  const statusLabels: Record<string, string> = {
    'completed': 'Selesai',
    'in-progress': 'Berjalan',
    'delayed': 'Terlambat',
    'not-started': 'Belum Mulai',
    'on-hold': 'Ditunda',
  };

  for (let pageStart = 0; pageStart < evidenceItems.length; pageStart += ITEMS_PER_PAGE) {
    const pageItems = evidenceItems.slice(pageStart, pageStart + ITEMS_PER_PAGE);
    doc.addPage();
    addSlideHeader(doc, 'Dokumentasi Evidence', 6);
    addSlideFooter(doc, 6);

    pageItems.forEach((evidence, index) => {
      const col = index % GRID_COLUMNS;
      const row = Math.floor(index / GRID_COLUMNS);
      const cardX = CONTENT_LEFT + col * (CARD_W + CARD_GAP_X);
      const cardY = CONTENT_TOP + row * (CARD_H + CARD_GAP_Y);

      const statusColor = statusColors[evidence.status] || statusColors['not-started'];
      const statusLabel = statusLabels[evidence.status] || evidence.status;
      const title = evidence.code ? `${evidence.code}. ${evidence.name}` : evidence.name;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.roundedRect(cardX, cardY, CARD_W, CARD_H, 2, 2, 'FD');

      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.rect(cardX, cardY, 2.5, CARD_HEADER_H, 'F');

      doc.setFillColor(248, 250, 252);
      doc.rect(cardX + 2.5, cardY, CARD_W - 2.5, CARD_HEADER_H, 'F');

      doc.setFontSize(6.3);
      doc.setFont('helvetica', 'bold');
      const badgeW = doc.getTextWidth(statusLabel) + 6;
      const badgeX = cardX + CARD_W - badgeW - 3;
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(badgeX, cardY + 3, badgeW, 5.5, 1.4, 1.4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(statusLabel, badgeX + badgeW / 2, cardY + 6.9, { align: 'center' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      const titleWidth = Math.max(20, CARD_W - badgeW - 13);
      const titleLine = doc.splitTextToSize(title, titleWidth)[0] || title;
      doc.text(titleLine, cardX + 5, cardY + 7.3);

      const previewX = cardX + 3;
      const previewY = cardY + CARD_HEADER_H + 3;
      const previewW = CARD_W - 6;
      const previewH = CARD_H - CARD_HEADER_H - 6;
      drawEvidenceCard(doc, evidence.item, previewX, previewY, previewW, previewH);
    });

    if (evidenceItems.length > ITEMS_PER_PAGE) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${pageStart + 1}-${pageStart + pageItems.length} dari ${evidenceItems.length} evidence`,
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - 10,
        { align: 'center' }
      );
    }
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function addSlideHeader(doc: jsPDF, title: string, slideNumber: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, 22);

  // Slide number
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`${slideNumber}`, pageWidth - MARGIN, 22, { align: 'right' });
}

function addSlideFooter(doc: jsPDF, slideNumber: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Slide ${slideNumber}`, MARGIN, pageHeight - 10);
  doc.text(formatDate(new Date()), pageWidth - MARGIN, pageHeight - 10, { align: 'right' });
}

function createTable(
  doc: jsPDF,
  headers: string[],
  data: string[][],
  x: number,
  y: number,
  options: {
    rowHeight?: number;
    fontSize?: number;
    headerFontSize?: number;
    maxY?: number;
    overflowLabel?: string;
  } = {}
): void {
  const colWidth = (PAGE_WIDTH - 2 * MARGIN) / headers.length;
  const rowHeight = options.rowHeight || 8;
  const maxY = options.maxY || REPORT_CONTENT_BOTTOM;
  const headerFontSize = options.headerFontSize || 11;
  const bodyFontSize = options.fontSize || 10;
  const maxRows = Math.max(0, Math.floor((maxY - y - rowHeight) / rowHeight));
  const visibleRows = data.slice(0, maxRows);

  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(x, y, PAGE_WIDTH - 2 * MARGIN, rowHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(headerFontSize);
  doc.setFont('helvetica', 'bold');

  headers.forEach((header, i) => {
    const text = doc.splitTextToSize(header, colWidth - 4)[0] || header;
    doc.text(text, x + i * colWidth + 2, y + rowHeight - 2.2);
  });

  // Rows
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bodyFontSize);

  visibleRows.forEach((row, rowIndex) => {
    const rowY = y + (rowIndex + 1) * rowHeight;

    // Alternate row colors
    if (rowIndex % 2 === 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(x, rowY, PAGE_WIDTH - 2 * MARGIN, rowHeight, 'F');
    }

    row.forEach((cell, colIndex) => {
      const rawText = String(cell || '-');
      const text = doc.splitTextToSize(rawText, colWidth - 4)[0] || rawText;
      doc.text(text, x + colIndex * colWidth + 2, rowY + rowHeight - 2.2);
    });
  });

  if (data.length > visibleRows.length) {
    const noteY = Math.min(maxY, y + (visibleRows.length + 1) * rowHeight + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(Math.max(6.5, bodyFontSize - 0.5));
    doc.setTextColor(100, 116, 139);
    doc.text(options.overflowLabel || `+${data.length - visibleRows.length} baris lain`, x, noteY);
  }
}

function drawPieSlice(
  doc: jsPDF,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): void {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  doc.moveTo(centerX, centerY);
  doc.lineTo(
    centerX + radius * Math.cos(startRad),
    centerY + radius * Math.sin(startRad)
  );

  // Arc approximation
  const steps = Math.max(10, Math.abs(endAngle - startAngle) / 5);
  for (let i = 0; i <= steps; i++) {
    const angle = startRad + (endRad - startRad) * (i / steps);
    doc.lineTo(
      centerX + radius * Math.cos(angle),
      centerY + radius * Math.sin(angle)
    );
  }

  doc.lineTo(centerX, centerY);
  doc.fill();
}

function drawSCurveChart(ctx: CanvasRenderingContext2D, data: any[]): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const padding = 60; // Increased padding for labels

  // Clear canvas
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Draw axes
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // Y-axis labels (0-100%)
  ctx.fillStyle = '#000000';
  ctx.font = '14px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= 10; i++) {
    const y = height - padding - (i / 10) * (height - 2 * padding);
    const value = i * 10;
    ctx.fillText(`${value}%`, padding - 10, y);

    // Gridlines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Y-axis title
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Progress (%)', 0, 0);
  ctx.restore();

  // X-axis labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '12px Arial';

  const labelInterval = Math.max(1, Math.floor(data.length / 8)); // Show max 8 labels
  data.forEach((point, index) => {
    if (index % labelInterval === 0 || index === data.length - 1) {
      const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
      ctx.fillText(point.periodLabel || `W${index + 1}`, x, height - padding + 10);
    }
  });

  // X-axis title
  ctx.font = 'bold 16px Arial';
  ctx.fillText('Period', width / 2, height - 15);

  // Draw baseline (blue)
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  data.forEach((point, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - (point.baseline / 100) * (height - 2 * padding);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Draw actual (green)
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.beginPath();
  data.forEach((point, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - (point.actual / 100) * (height - 2 * padding);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Legend
  ctx.font = '16px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3b82f6';
  ctx.fillText('■ Baseline', width - 150, 30);
  ctx.fillStyle = '#10b981';
  ctx.fillText('■ Actual', width - 150, 50);
}

function calculateWeeklyMetrics(
  activities: any[],
  weekStart: Date,
  weekEnd: Date
): WeeklyMetrics {
  const total = activities.length;

  const completedThisWeek = activities.filter(a => {
    if (a.status !== 'completed' || !a.endDate) return false;
    const endDate = new Date(a.endDate);
    return endDate >= weekStart && endDate <= weekEnd;
  }).length;

  const inProgress = activities.filter(a => a.status === 'in-progress').length;
  const delayed = activities.filter(a => a.status === 'delayed').length;
  const notStarted = activities.filter(a => a.status === 'not-started').length;
  const onHold = activities.filter(a => a.status === 'on-hold').length;
  const completed = activities.filter(a => a.status === 'completed').length;

  const overallProgress = total > 0 ? (completed / total) * 100 : 0;

  let status: 'on-track' | 'at-risk' | 'delayed' = 'on-track';
  if (delayed > 0) {
    status = 'delayed';
  } else if (delayed > total * 0.1) {
    status = 'at-risk';
  }

  return {
    totalActivities: total,
    completedThisWeek,
    inProgress,
    delayed,
    notStarted,
    onHold,
    overallProgress,
    status,
  };
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff));
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Sunday
  return end;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// =====================================================
// ALL PROJECTS REPORT
// =====================================================

interface AllReportProjectData {
  id: string;
  name: string;
  pic: string;
  location?: string;
  category?: string;
  description?: string;
  startDate: string;
  endDate: string;
  status?: string;
  budget?: number;
}

/**
 * Progress callback for UI updates
 */
export type AllReportProgressCallback = (message: string) => void;

/**
 * Generate a single PDF report containing all projects
 */
export async function generateAllProjectsReport(
  onProgress?: AllReportProgressCallback,
  filterYear?: number | null
): Promise<void> {
  try {
    onProgress?.('Memuat data project...');

    const { fetchProjects: getProjects } = await import('./supabase');
    let allProjects = await getProjects();

    // Filter by year if specified
    if (filterYear) {
      allProjects = allProjects.filter(p => {
        const year = p.startDate ? new Date(p.startDate).getFullYear() : null;
        return year === filterYear;
      });
    }

    if (allProjects.length === 0) {
      throw new Error(filterYear
        ? `Tidak ada project untuk tahun ${filterYear}`
        : 'Tidak ada project untuk di-report'
      );
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let globalSlide = 1;

    // ── SLIDE 1: Cover ──
    onProgress?.('Membuat cover...');
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Accent
    doc.setFillColor(16, 185, 129); // Emerald
    doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');
    doc.setFillColor(59, 130, 246); // Blue accent circle
    doc.circle(pageWidth - 40, 40, 70, 'F');

    // Logo
    try {
      const logoImg = new Image();
      logoImg.src = '/logo_putih.png';
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        setTimeout(reject, 2000);
      });
      const ratio = logoImg.width / logoImg.height;
      doc.addImage(logoImg, 'PNG', MARGIN, MARGIN, 20 * ratio, 20);
    } catch { /* skip */ }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(38);
    doc.setFont('helvetica', 'bold');
    const yearLabel = filterYear ? ` Tahun ${filterYear}` : '';
    doc.text(`Laporan Seluruh Project${yearLabel}`, pageWidth / 2, 80, { align: 'center' });

    doc.setFontSize(20);
    doc.setFont('helvetica', 'normal');
    doc.text('Pertamina Foundation', pageWidth / 2, 100, { align: 'center' });

    doc.setFontSize(14);
    doc.text(`${allProjects.length} Project${yearLabel} · ${formatDate(new Date())}`, pageWidth / 2, 115, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text('Dibuat otomatis oleh sistem Project Fungsi Lingkungan', pageWidth / 2, pageHeight - 15, { align: 'center' });

    // ── SLIDE 2: Portfolio Overview Table ──
    doc.addPage();
    globalSlide++;
    onProgress?.('Membuat overview portfolio...');

    addSlideHeader(doc, 'Portfolio Overview', globalSlide);

    // Collect metrics for all projects first
    const allProjectMetrics: {
      project: AllReportProjectData;
      activities: any[];
      metrics: WeeklyMetrics;
      scurveData: any[];
    }[] = [];

    for (let i = 0; i < allProjects.length; i++) {
      const p = allProjects[i];
      onProgress?.(`Memuat data project ${i + 1}/${allProjects.length}: ${p.name}...`);
      const acts = await fetchActivities(p.id);
      const scurve = await fetchSCurveData(p.id);
      const met = calculateWeeklyMetrics(acts, getWeekStart(new Date()), getWeekEnd(new Date()));
      allProjectMetrics.push({ project: p, activities: acts, metrics: met, scurveData: scurve });
    }

    // Draw overview table
    let ty = 48;
    const colWidths = [85, 30, 35, 35, 35, 38]; // name, status, progress, completed, delayed, timeline
    const headers = ['Project', 'Status', 'Progress', 'Selesai', 'Delay', 'Timeline'];

    // Header row
    doc.setFillColor(59, 130, 246);
    doc.rect(MARGIN, ty, pageWidth - 2 * MARGIN, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    let cx = MARGIN;
    headers.forEach((h, i) => {
      doc.text(h, cx + 2, ty + 6);
      cx += colWidths[i];
    });

    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    const maxRows = Math.min(allProjectMetrics.length, 18); // max rows per page
    for (let r = 0; r < maxRows; r++) {
      const { project: p, metrics: m } = allProjectMetrics[r];
      const rowY = ty + (r + 1) * 8;

      if (r % 2 === 0) {
        doc.setFillColor(241, 245, 249);
        doc.rect(MARGIN, rowY, pageWidth - 2 * MARGIN, 8, 'F');
      }

      doc.setTextColor(15, 23, 42);
      cx = MARGIN;
      const rowData = [
        (p.name || '').substring(0, 40),
        m.status === 'on-track' ? 'On Track' : m.status === 'at-risk' ? 'At Risk' : 'Delayed',
        `${m.overallProgress.toFixed(1)}%`,
        `${m.completedThisWeek}/${m.totalActivities}`,
        `${m.delayed}`,
        `${p.startDate?.substring(0, 10) || ''} → ${p.endDate?.substring(0, 10) || ''}`,
      ];
      rowData.forEach((cell, i) => {
        // Color status cell
        if (i === 1) {
          if (m.status === 'on-track') doc.setTextColor(16, 185, 129);
          else if (m.status === 'at-risk') doc.setTextColor(245, 158, 11);
          else doc.setTextColor(239, 68, 68);
        } else if (i === 4 && m.delayed > 0) {
          doc.setTextColor(239, 68, 68);
        } else {
          doc.setTextColor(15, 23, 42);
        }
        const txt = cell.length > 42 ? cell.substring(0, 39) + '...' : cell;
        doc.text(txt, cx + 2, rowY + 6);
        cx += colWidths[i];
      });
    }

    addSlideFooter(doc, globalSlide);

    // ── PER-PROJECT SLIDES ──
    for (let i = 0; i < allProjectMetrics.length; i++) {
      const { project: proj, activities, metrics: met, scurveData } = allProjectMetrics[i];
      onProgress?.(`Membuat slide project ${i + 1}/${allProjectMetrics.length}: ${proj.name}...`);

      // ── Project Cover Slide ──
      doc.addPage();
      globalSlide++;

      doc.setFillColor(30, 64, 175); // Blue-800
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setFillColor(16, 185, 129);
      doc.rect(0, pageHeight - 4, pageWidth, 4, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(`PROJECT ${i + 1} / ${allProjectMetrics.length}`, pageWidth / 2, 50, { align: 'center' });

      doc.setFontSize(32);
      doc.setFont('helvetica', 'bold');
      const projName = proj.name.length > 45 ? proj.name.substring(0, 42) + '...' : proj.name;
      doc.text(projName, pageWidth / 2, 80, { align: 'center' });

      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      // PIC hidden per user request
      // doc.text(`PIC: ${proj.pic || '-'}`, pageWidth / 2, 100, { align: 'center' });
      doc.text(`${proj.location || '-'}`, pageWidth / 2, 112, { align: 'center' });

      doc.setFontSize(13);
      doc.text(`${proj.startDate?.substring(0, 10) || ''} — ${proj.endDate?.substring(0, 10) || ''}`, pageWidth / 2, 130, { align: 'center' });

      if (proj.budget) {
        doc.text(`Budget: ${formatBudgetJuta(proj.budget)}`, pageWidth / 2, 142, { align: 'center' });
      }

      // ── Executive Summary + S-Curve Slide ──
      doc.addPage();
      globalSlide++;
      addSlideHeader(doc, `${proj.name} — Summary & S-Curve`, globalSlide);

      // Left: Metrics
      let sy = 48;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Metrics', MARGIN, sy);

      sy += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const metricItems = [
        ['Overall Progress', `${met.overallProgress.toFixed(1)}%`],
        ['Total Activities', `${met.totalActivities}`],
        ['Completed', `${met.completedThisWeek}`],
        ['In Progress', `${met.inProgress}`],
        ['Delayed', `${met.delayed}`],
        ['Not Started', `${met.notStarted}`],
        ['Status', met.status === 'on-track' ? 'On Track' : met.status === 'at-risk' ? 'At Risk' : 'Delayed'],
      ];

      metricItems.forEach(([label, value], idx) => {
        const my = sy + idx * 8;
        doc.setTextColor(100, 116, 139);
        doc.text(label, MARGIN + 2, my);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(value, MARGIN + 60, my);
        doc.setFont('helvetica', 'normal');
      });

      // Progress bar
      const barY = sy + metricItems.length * 8 + 5;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(MARGIN, barY, 80, 6, 2, 2, 'F');
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(MARGIN, barY, Math.min(80, (met.overallProgress / 100) * 80), 6, 2, 2, 'F');

      // Right: S-Curve Chart
      if (scurveData && scurveData.length > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawSCurveChart(ctx, scurveData);
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', 120, 45, 155, 78);
        }
      } else {
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text('Data S-Curve tidak tersedia', 195, 85, { align: 'center' });
      }

      addSlideFooter(doc, globalSlide);

      // ── Activities Status Slide ──
      if (activities.length > 0) {
        doc.addPage();
        globalSlide++;
        addSlideHeader(doc, `${proj.name} — Activities`, globalSlide);

        const actHeaders = ['Kode', 'Activity', 'Status', 'Bobot'];
        const actData = activities.slice(0, 16).map((a: any) => [
          (a.code || '-').substring(0, 8),
          (a.activityName || a.activity_name || '-').substring(0, 45),
          (a.status || 'not-started'),
          `${(a.weight || 0)}%`,
        ]);

        createTable(doc, actHeaders, actData, MARGIN, 48);
        addSlideFooter(doc, globalSlide);
      }

      // ── Evidence Slides (Images) ──
      if (activities.length > 0) {
        // Collect image evidence
        interface ActEvidence { code: string; name: string; status: string; imageUrls: string[]; pdfUrls: string[]; }
        const evidenceList: ActEvidence[] = [];
        for (const act of activities) {
          const allUrls = parseEvidenceField(act.evidence);
          const imageUrls = allUrls.filter(isImageUrl);
          const pdfUrls = allUrls.filter((u: string) => u.toLowerCase().split('?')[0].endsWith('.pdf'));
          if (imageUrls.length > 0 || pdfUrls.length > 0) {
            evidenceList.push({
              code: act.code || '',
              name: act.activityName || act.activity_name || 'Unknown',
              status: act.status || 'not-started',
              imageUrls,
              pdfUrls,
            });
          }
        }

        if (evidenceList.length > 0) {
          // Image evidence slides
          const imageEvidence = evidenceList.filter(e => e.imageUrls.length > 0);
          if (imageEvidence.length > 0) {
            const CONTENT_LEFT = MARGIN;
            const CONTENT_RIGHT = pageWidth - MARGIN;
            const CONTENT_W = CONTENT_RIGHT - CONTENT_LEFT;
            const CONTENT_TOP_E = 42;
            const CONTENT_BOTTOM_E = pageHeight - 16;
            const HDR_H = 9;
            const PHOTO_H = 35;
            const PHOTO_GAP = 3;
            const SEC_GAP = 5;
            const MAX_ROW = 4;

            const stColors: Record<string, [number, number, number]> = {
              'completed': [34, 197, 94], 'in-progress': [59, 130, 246],
              'delayed': [239, 68, 68], 'not-started': [148, 163, 184], 'on-hold': [245, 158, 11],
            };
            const stLabels: Record<string, string> = {
              'completed': 'Selesai', 'in-progress': 'Berjalan',
              'delayed': 'Terlambat', 'not-started': 'Belum Mulai', 'on-hold': 'Ditunda',
            };

            let ey = CONTENT_BOTTOM_E + 1;

            const newEvPage = () => {
              doc.addPage();
              globalSlide++;
              addSlideHeader(doc, `${proj.name} — Evidence`, globalSlide);
              addSlideFooter(doc, globalSlide);
              ey = CONTENT_TOP_E;
            };

            const ensureEv = (needed: number) => {
              if (ey + needed > CONTENT_BOTTOM_E) newEvPage();
            };

            for (const ev of imageEvidence) {
              ensureEv(HDR_H + 2 + PHOTO_H + SEC_GAP);

              const sc = stColors[ev.status] || stColors['not-started'];
              const sl = stLabels[ev.status] || ev.status;

              // Header accent
              doc.setFillColor(sc[0], sc[1], sc[2]);
              doc.rect(CONTENT_LEFT, ey, 2.5, HDR_H, 'F');
              doc.setFillColor(245, 247, 250);
              doc.rect(CONTENT_LEFT + 2.5, ey, CONTENT_W - 2.5, HDR_H, 'F');

              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(30, 41, 59);
              const htxt = ev.code ? `${ev.code}. ${ev.name}` : ev.name;
              doc.text(htxt.substring(0, 80), CONTENT_LEFT + 5, ey + 6);

              // Status badge
              doc.setFontSize(6);
              const bW = doc.getTextWidth(sl) + 6;
              const bX = CONTENT_RIGHT - bW - 3;
              doc.setFillColor(sc[0], sc[1], sc[2]);
              doc.roundedRect(bX, ey + 1.5, bW, 6, 1.5, 1.5, 'F');
              doc.setTextColor(255, 255, 255);
              doc.text(sl, bX + bW / 2, ey + 5.5, { align: 'center' });

              doc.setFont('helvetica', 'normal');
              doc.setTextColor(100, 116, 139);
              doc.text(`${ev.imageUrls.length} foto`, bX - 20, ey + 5.5);

              ey += HDR_H + 2;

              // Load & render photos
              const imgs = await Promise.all(ev.imageUrls.map(u => loadImageFromUrl(u)));
              const photoW = (CONTENT_W - (MAX_ROW - 1) * PHOTO_GAP) / MAX_ROW;

              for (let pi = 0; pi < ev.imageUrls.length; pi++) {
                const col = pi % MAX_ROW;
                if (col === 0 && pi > 0) {
                  ey += PHOTO_H + PHOTO_GAP;
                  ensureEv(PHOTO_H + PHOTO_GAP);
                }

                const px = CONTENT_LEFT + col * (photoW + PHOTO_GAP);
                doc.setFillColor(249, 250, 251);
                doc.setDrawColor(226, 232, 240);
                doc.setLineWidth(0.2);
                doc.roundedRect(px, ey, photoW, PHOTO_H, 1.5, 1.5, 'FD');

                const img = imgs[pi];
                const pad = 2;
                if (img) {
                  const aspect = img.width / img.height;
                  let dW = photoW - 2 * pad;
                  let dH = dW / aspect;
                  if (dH > PHOTO_H - 2 * pad) { dH = PHOTO_H - 2 * pad; dW = dH * aspect; }
                  try {
                    doc.addImage(img, 'JPEG', px + (photoW - dW) / 2, ey + (PHOTO_H - dH) / 2, dW, dH);
                  } catch {
                    doc.setFontSize(6); doc.setTextColor(160, 160, 160);
                    doc.text('Gagal', px + photoW / 2, ey + PHOTO_H / 2, { align: 'center' });
                  }
                } else {
                  doc.setFontSize(6); doc.setTextColor(180, 180, 180);
                  doc.text('Gagal', px + photoW / 2, ey + PHOTO_H / 2, { align: 'center' });
                }
              }
              ey += PHOTO_H + SEC_GAP;
            }
          }

          // PDF evidence listing slide
          const pdfEvidence = evidenceList.filter(e => e.pdfUrls.length > 0);
          if (pdfEvidence.length > 0) {
            doc.addPage();
            globalSlide++;
            addSlideHeader(doc, `${proj.name} — Dokumen Evidence (PDF)`, globalSlide);

            let py = 48;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text('Dokumen PDF terlampir sebagai referensi:', MARGIN, py);
            py += 10;

            for (const ev of pdfEvidence) {
              if (py > pageHeight - 25) {
                doc.addPage();
                globalSlide++;
                addSlideHeader(doc, `${proj.name} — Dokumen Evidence (PDF)`, globalSlide);
                py = 48;
              }

              // Activity header
              doc.setFontSize(9);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(30, 41, 59);
              const aLabel = ev.code ? `${ev.code}. ${ev.name}` : ev.name;
              doc.text(aLabel.substring(0, 70), MARGIN + 2, py);
              py += 6;

              // PDF files
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              let linkNum = 0;
              for (const pdfUrl of ev.pdfUrls) {
                linkNum++;
                if (py > pageHeight - 20) {
                  doc.addPage();
                  globalSlide++;
                  addSlideHeader(doc, `${proj.name} — Dokumen Evidence (PDF)`, globalSlide);
                  py = 48;
                }
                doc.setTextColor(59, 130, 246);
                doc.text(`📄 Link ${linkNum}`, MARGIN + 6, py);
                // Add clickable link
                doc.link(MARGIN + 6, py - 3, 200, 5, { url: pdfUrl });
                py += 6;
              }
              py += 4;
            }
            addSlideFooter(doc, globalSlide);
          }
        }
      }
    }

    // ── CLOSING SLIDE ──
    doc.addPage();
    globalSlide++;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(16, 185, 129);
    doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text('Terima Kasih', pageWidth / 2, 80, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Pertamina Foundation', pageWidth / 2, 100, { align: 'center' });
    doc.text(`${allProjects.length} Project · ${globalSlide} Slides`, pageWidth / 2, 115, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text(`Dibuat: ${formatDate(new Date())}`, pageWidth / 2, 135, { align: 'center' });

    // Save
    onProgress?.('Menyimpan PDF...');
    const fileName = `All_Report_Project_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    onProgress?.('Selesai!');
  } catch (error) {
    console.error('Error generating all projects report:', error);
    throw error;
  }
}
