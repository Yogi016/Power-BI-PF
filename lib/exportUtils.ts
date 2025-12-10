import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

interface ExportData {
  projectName: string;
  pic: string;
  activities: Array<{
    code: string;
    activityName: string;
    startDate: string;
    endDate: string;
    status: string;
    weight: number;
    progress?: number;
  }>;
  metrics?: {
    totalProgress: number;
    completedActivities: number;
    totalActivities: number;
  };
}

/**
 * Export project data to PDF with logo
 */
export async function exportToPDF(data: ExportData, chartElement?: HTMLElement): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 30; // Start below logos

  try {
    // Add logo_putih.png on the left if exists
    try {
      const logoData = await loadImageWithDimensions('/logo_putih.png');
      const logoHeight = 12;
      const logoWidth = (logoData.width / logoData.height) * logoHeight;
      doc.addImage(logoData.dataUrl, 'PNG', 15, 10, logoWidth, logoHeight);
    } catch (error) {
      console.warn('logo_putih.png not found, continuing without left logo');
    }

    // Add pf-logo.png on the right if exists
    try {
      const pfLogoData = await loadImageWithDimensions('/pf-logo.png');
      const pfLogoHeight = 12;
      const pfLogoWidth = (pfLogoData.width / pfLogoData.height) * pfLogoHeight;
      doc.addImage(pfLogoData.dataUrl, 'PNG', pageWidth - pfLogoWidth - 15, 10, pfLogoWidth, pfLogoHeight);
    } catch (error) {
      console.warn('pf-logo.png not found, continuing without right logo');
    }

    // Header - positioned below logos
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138); // Blue
    doc.text('Laporan Progress Project', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 15;

    // Project Info
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Informasi Project', 15, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Nama Project: ${data.projectName}`, 15, yPosition);
    yPosition += 6;
    doc.text(`PIC: ${data.pic}`, 15, yPosition);
    yPosition += 10;

    // Metrics (if available)
    if (data.metrics) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Ringkasan Progress', 15, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total Progress: ${data.metrics.totalProgress.toFixed(1)}%`, 15, yPosition);
      yPosition += 6;
      doc.text(`Activities Selesai: ${data.metrics.completedActivities} / ${data.metrics.totalActivities}`, 15, yPosition);
      yPosition += 10;
    }

    // Activities Table
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Daftar Activities', 15, yPosition);
    yPosition += 5;

    const tableData = data.activities.map(activity => [
      activity.code,
      activity.activityName,
      activity.startDate || '-',
      activity.endDate || '-',
      activity.status,
      `${activity.weight}%`,
      activity.progress !== undefined ? `${activity.progress}%` : '-',
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Kode', 'Activity', 'Start', 'End', 'Status', 'Bobot', 'Progress']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246], // Blue
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: 50,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 60 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 15 },
        6: { cellWidth: 15 },
      },
      margin: { left: 15, right: 15 },
    });

    // Add chart if provided
    if (chartElement) {
      const canvas = await html2canvas(chartElement, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 30;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Check if we need a new page
      const finalY = (doc as any).lastAutoTable.finalY || yPosition;
      if (finalY + imgHeight + 20 > pageHeight) {
        doc.addPage();
        yPosition = 20;
      } else {
        yPosition = finalY + 15;
      }

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Gantt Chart Timeline', 15, yPosition);
      yPosition += 5;
      
      doc.addImage(imgData, 'PNG', 15, yPosition, imgWidth, imgHeight);
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Halaman ${i} dari ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save PDF
    const fileName = `Laporan_${data.projectName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Gagal membuat PDF. Silakan coba lagi.');
  }
}

/**
 * Export project data to Excel
 */
export function exportToExcel(data: ExportData): void {
  try {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Project Info
    const projectInfo = [
      ['Laporan Progress Project'],
      [''],
      ['Nama Project', data.projectName],
      ['PIC', data.pic],
      ['Tanggal Export', new Date().toLocaleDateString('id-ID')],
      [''],
    ];

    if (data.metrics) {
      projectInfo.push(
        ['Total Progress', `${data.metrics.totalProgress.toFixed(1)}%`],
        ['Activities Selesai', `${data.metrics.completedActivities} / ${data.metrics.totalActivities}`],
        ['']
      );
    }

    const wsInfo = XLSX.utils.aoa_to_sheet(projectInfo);
    
    // Set column widths
    wsInfo['!cols'] = [
      { wch: 20 },
      { wch: 50 },
    ];

    XLSX.utils.book_append_sheet(workbook, wsInfo, 'Info Project');

    // Sheet 2: Activities
    const activitiesData = [
      ['Kode', 'Nama Activity', 'Start Date', 'End Date', 'Status', 'Bobot (%)', 'Progress (%)'],
      ...data.activities.map(activity => [
        activity.code,
        activity.activityName,
        activity.startDate || '-',
        activity.endDate || '-',
        activity.status,
        activity.weight,
        activity.progress !== undefined ? activity.progress : '-',
      ]),
    ];

    const wsActivities = XLSX.utils.aoa_to_sheet(activitiesData);
    
    // Set column widths
    wsActivities['!cols'] = [
      { wch: 10 },
      { wch: 40 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(workbook, wsActivities, 'Activities');

    // Save Excel
    const fileName = `Laporan_${data.projectName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  } catch (error) {
    console.error('Error generating Excel:', error);
    throw new Error('Gagal membuat Excel. Silakan coba lagi.');
  }
}

/**
 * Helper function to load image with dimensions
 */
function loadImageWithDimensions(src: string): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: img.width,
          height: img.height,
        });
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Helper function to load image (legacy - kept for compatibility)
 */
function loadImage(src: string): Promise<string> {
  return loadImageWithDimensions(src).then(data => data.dataUrl);
}
