import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { fetchActivities, fetchSCurveData } from './supabase';

// Page dimensions for A4 Landscape (PowerPoint style)
const PAGE_WIDTH = 297; // mm
const PAGE_HEIGHT = 210; // mm
const MARGIN = 20; // mm

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
    
    await createExecutiveSummary(doc, project, metrics);
    doc.addPage();
    
    await createSCurveSlide(doc, scurveData);
    doc.addPage();
    
    await createStatusBreakdown(doc, activities);
    doc.addPage();
    
    await createCompletedActivities(doc, activities, start, end);
    doc.addPage();
    
    await createOngoingActivities(doc, activities);
    doc.addPage();
    
    await createIssuesSlide(doc, activities);
    doc.addPage();
    
    await createNextWeekPlan(doc, activities, end);
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
  metrics: WeeklyMetrics
): Promise<void> {
  addSlideHeader(doc, 'Executive Summary', 2);

  let yPos = 50;

  // Overall Progress with visual bar
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Overall Progress', MARGIN, yPos);
  
  yPos += 10;
  doc.setFontSize(36); // Reduced from 42 to 36
  doc.setTextColor(59, 130, 246);
  doc.text(`${metrics.overallProgress.toFixed(1)}%`, MARGIN, yPos);

  // Progress bar
  yPos += 8;
  const barWidth = 80;
  const barHeight = 8;
  
  // Background bar
  doc.setFillColor(226, 232, 240); // Gray
  doc.roundedRect(MARGIN, yPos, barWidth, barHeight, 2, 2, 'F');
  
  // Progress bar
  const progressWidth = (metrics.overallProgress / 100) * barWidth;
  doc.setFillColor(59, 130, 246); // Blue
  doc.roundedRect(MARGIN, yPos, progressWidth, barHeight, 2, 2, 'F');

  // Status indicator with badge
  yPos += 15;
  doc.setFontSize(14);
  
  const statusColor = metrics.status === 'on-track' ? [16, 185, 129] : metrics.status === 'at-risk' ? [245, 158, 11] : [239, 68, 68];
  const statusText = metrics.status === 'on-track' ? 'On Track' : metrics.status === 'at-risk' ? 'At Risk' : 'Delayed';
  
  // Status badge background
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(MARGIN, yPos - 5, 35, 8, 2, 2, 'F');
  
  // Status text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, MARGIN + 17.5, yPos, { align: 'center' });

  // Metrics grid with better layout
  yPos = 50;
  const col2X = 130;
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Metrics', col2X, yPos);
  
  yPos += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  
  const metricsData = [
    { label: 'Total Activities', value: metrics.totalActivities, color: [100, 116, 139] },
    { label: 'Completed This Week', value: metrics.completedThisWeek, color: [16, 185, 129] },
    { label: 'In Progress', value: metrics.inProgress, color: [59, 130, 246] },
    { label: 'Delayed', value: metrics.delayed, color: [239, 68, 68] },
    { label: 'Not Started', value: metrics.notStarted, color: [148, 163, 184] },
    { label: 'On Hold', value: metrics.onHold, color: [245, 158, 11] },
  ];

  metricsData.forEach((item, index) => {
    const y = yPos + (index * 10);
    
    // Color indicator
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.circle(col2X, y - 2, 2, 'F');
    
    // Label
    doc.setTextColor(0, 0, 0);
    doc.text(item.label + ':', col2X + 5, y);
    
    // Value with background
    doc.setFont('helvetica', 'bold');
    const valueText = item.value.toString();
    const valueWidth = doc.getTextWidth(valueText);
    
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(col2X + 70, y - 4, valueWidth + 4, 6, 1, 1, 'F');
    
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(valueText, col2X + 72, y);
    
    doc.setFont('helvetica', 'normal');
  });

  // Summary box
  yPos += 75;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(MARGIN, yPos, PAGE_WIDTH - 2 * MARGIN, 25, 3, 3, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary:', MARGIN + 5, yPos + 8);
  
  doc.setFont('helvetica', 'normal');
  const summaryText = `Project "${project.name}" is ${metrics.overallProgress.toFixed(1)}% complete with ${metrics.completedThisWeek} activities completed this week. Status: ${statusText}.`;
  const splitText = doc.splitTextToSize(summaryText, PAGE_WIDTH - 2 * MARGIN - 10);
  doc.text(splitText, MARGIN + 5, yPos + 15);

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

  // Count by status
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

  // Draw pie chart
  const centerX = 80;
  const centerY = 100;
  const radius = 40;

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  let startAngle = -90;

  const statusColors: Record<string, string> = {
    'not-started': '#94a3b8',
    'in-progress': '#3b82f6',
    'completed': '#10b981',
    'delayed': '#ef4444',
    'on-hold': '#f59e0b',
  };

  Object.entries(statusCounts).forEach(([status, count]) => {
    if (count > 0) {
      const percentage = (count / total) * 100;
      const angle = (percentage / 100) * 360;
      
      doc.setFillColor(statusColors[status]);
      drawPieSlice(doc, centerX, centerY, radius, startAngle, startAngle + angle);
      
      startAngle += angle;
    }
  });

  // Legend
  let legendY = 60;
  const legendX = 150;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Status Distribution', legendX, legendY);
  legendY += 10;

  doc.setFont('helvetica', 'normal');
  Object.entries(statusCounts).forEach(([status, count]) => {
    doc.setFillColor(statusColors[status]);
    doc.rect(legendX, legendY - 3, 5, 5, 'F');
    
    doc.setTextColor(0, 0, 0);
    const label = status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    doc.text(`${label}: ${count} (${((count / total) * 100).toFixed(1)}%)`, legendX + 8, legendY);
    
    legendY += 8;
  });

  addSlideFooter(doc, 4);
}

/**
 * Slide 5: Completed Activities
 */
async function createCompletedActivities(
  doc: jsPDF,
  activities: any[],
  weekStart: Date,
  weekEnd: Date
): Promise<void> {
  addSlideHeader(doc, 'Completed Activities This Week', 5);

  const completed = activities.filter(a => a.status === 'completed');

  if (completed.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('No activities completed this week', PAGE_WIDTH / 2, 100, { align: 'center' });
  } else {
    // Table
    const tableData = completed.slice(0, 10).map(a => [
      a.code || '',
      a.activityName || a.activity || '',
      a.pic || '',
      a.endDate || '',
    ]);

    createTable(doc, 
      ['Code', 'Activity Name', 'PIC', 'Completion Date'],
      tableData,
      MARGIN,
      55
    );

    if (completed.length > 10) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`... and ${completed.length - 10} more`, MARGIN, 170);
    }
  }

  addSlideFooter(doc, 5);
}

/**
 * Slide 6: Ongoing Activities
 */
async function createOngoingActivities(doc: jsPDF, activities: any[]): Promise<void> {
  addSlideHeader(doc, 'Ongoing Activities', 6);

  const ongoing = activities.filter(a => a.status === 'in-progress');

  if (ongoing.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('No ongoing activities', PAGE_WIDTH / 2, 100, { align: 'center' });
  } else {
    const tableData = ongoing.slice(0, 10).map(a => [
      a.code || '',
      a.activityName || a.activity || '',
      a.pic || '',
      a.endDate || '',
    ]);

    createTable(doc,
      ['Code', 'Activity Name', 'PIC', 'Expected End'],
      tableData,
      MARGIN,
      55
    );

    if (ongoing.length > 10) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`... and ${ongoing.length - 10} more`, MARGIN, 170);
    }
  }

  addSlideFooter(doc, 6);
}

/**
 * Slide 7: Issues & Delays
 */
async function createIssuesSlide(doc: jsPDF, activities: any[]): Promise<void> {
  addSlideHeader(doc, 'Issues & Delays', 7);

  const delayed = activities.filter(a => a.status === 'delayed');

  if (delayed.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129); // Green
    doc.text('✓ No delayed activities', PAGE_WIDTH / 2, 100, { align: 'center' });
  } else {
    const tableData = delayed.slice(0, 10).map(a => [
      a.code || '',
      a.activityName || a.activity || '',
      a.pic || '',
      a.endDate || '',
    ]);

    createTable(doc,
      ['Code', 'Activity Name', 'PIC', 'Due Date'],
      tableData,
      MARGIN,
      55
    );

    if (delayed.length > 10) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`... and ${delayed.length - 10} more`, MARGIN, 170);
    }
  }

  addSlideFooter(doc, 7);
}

/**
 * Slide 8: Next Week Plan
 */
async function createNextWeekPlan(doc: jsPDF, activities: any[], weekEnd: Date): Promise<void> {
  addSlideHeader(doc, 'Next Week Plan', 8);

  const nextWeekStart = new Date(weekEnd);
  nextWeekStart.setDate(nextWeekStart.getDate() + 1);
  
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

  // Activities starting next week
  const upcoming = activities.filter(a => {
    if (!a.startDate) return false;
    const start = new Date(a.startDate);
    return start >= nextWeekStart && start <= nextWeekEnd;
  });

  if (upcoming.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('No activities scheduled for next week', PAGE_WIDTH / 2, 100, { align: 'center' });
  } else {
    const tableData = upcoming.slice(0, 10).map(a => [
      a.code || '',
      a.activityName || a.activity || '',
      a.pic || '',
      a.startDate || '',
    ]);

    createTable(doc,
      ['Code', 'Activity Name', 'PIC', 'Start Date'],
      tableData,
      MARGIN,
      55
    );

    if (upcoming.length > 10) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`... and ${upcoming.length - 10} more`, MARGIN, 170);
    }
  }

  addSlideFooter(doc, 8);
}

/**
 * Slide 9: Closing Slide
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
  y: number
): void {
  const colWidth = (PAGE_WIDTH - 2 * MARGIN) / headers.length;
  const rowHeight = 8;

  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(x, y, PAGE_WIDTH - 2 * MARGIN, rowHeight, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  
  headers.forEach((header, i) => {
    doc.text(header, x + i * colWidth + 2, y + 6);
  });

  // Rows
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  data.forEach((row, rowIndex) => {
    const rowY = y + (rowIndex + 1) * rowHeight;
    
    // Alternate row colors
    if (rowIndex % 2 === 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(x, rowY, PAGE_WIDTH - 2 * MARGIN, rowHeight, 'F');
    }
    
    row.forEach((cell, colIndex) => {
      const text = cell.length > 30 ? cell.substring(0, 27) + '...' : cell;
      doc.text(text, x + colIndex * colWidth + 2, rowY + 6);
    });
  });
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
