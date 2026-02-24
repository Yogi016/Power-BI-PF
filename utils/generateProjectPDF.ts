import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

// =====================================================
// TYPES
// =====================================================

export interface SignatureInfo {
    name: string;
    role: string; // e.g. "Project Head Lingkungan"
}

export interface ProjectPDFData {
    id: string;
    name: string;
    pic: string;
    description?: string;
    category?: string;
    location?: string;
    startDate: string;
    endDate: string;
    status: string;
    budget?: number;
    activities: {
        code: string;
        activityName: string;
        startDate: string;
        endDate: string;
        status: string;
        weight: number;
    }[];
    sCurveData?: {
        periodLabel: string;
        baseline: number;
        actual: number;
    }[];
    signatures: SignatureInfo[];
}

// =====================================================
// HELPERS
// =====================================================

const STATUS_LABELS: Record<string, string> = {
    'not-started': 'Belum Dimulai',
    'in-progress': 'Sedang Berjalan',
    completed: 'Selesai',
    delayed: 'Terlambat',
    'on-hold': 'Ditunda',
    active: 'Aktif',
    cancelled: 'Dibatalkan',
};

function formatDate(iso: string): string {
    if (!iso) return '-';
    try {
        return new Date(iso).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
}

function formatCurrency(value?: number): string {
    if (!value) return '-';
    return `Rp ${value.toLocaleString('id-ID')}`;
}

/** Simple hash for verification code */
async function generateVerificationHash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 12).toUpperCase();
}

async function generateQRDataURL(data: string): Promise<string> {
    return QRCode.toDataURL(data, {
        width: 120,
        margin: 1,
        color: { dark: '#1e293b', light: '#ffffff' },
    });
}

/** Load an image from a URL and return as base64 data URL */
async function loadImageAsDataURL(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

// =====================================================
// MAIN PDF GENERATOR
// =====================================================

export async function generateProjectPDF(data: ProjectPDFData): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Load logo
    const logoDataUrl = await loadImageAsDataURL('/pf-logo.png');

    // ─── HEADER ───────────────────────────────────────────
    // Green accent bar
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(0, 0, pageWidth, 3, 'F');

    // Logo on the right
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - 42, 7, 42, 14);
    }

    // Title block
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    y = 18;
    doc.text('LAPORAN PROJECT', margin, y);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    y += 7;
    doc.text('Pertamina Foundation — Project Fungsi Lingkungan', margin, y);

    // Date generated
    const generatedDate = formatDate(new Date().toISOString());
    doc.setFontSize(8);
    doc.text(`Diunduh: ${generatedDate}`, pageWidth - margin, y + 6, { align: 'right' });

    // Separator
    y += 10;
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    // ─── PROJECT INFO ─────────────────────────────────────
    y += 8;

    const infoFields: [string, string][] = [
        ['Nama Project', data.name],
        ['PIC', data.pic],
        ['Uraian Kegiatan', data.description || '-'],
        ['Category', data.category || '-'],
        ['Lokasi', data.location || '-'],
        ['Periode', `${formatDate(data.startDate)} — ${formatDate(data.endDate)}`],
        ['Budget', formatCurrency(data.budget)],
        ['Status', STATUS_LABELS[data.status] || data.status],
    ];

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Informasi Project', margin, y);
    y += 7;

    doc.setFontSize(9);
    for (const [label, value] of infoFields) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(`${label}`, margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);

        // Handle long text wrapping for description
        if (label === 'Uraian Kegiatan' && value.length > 70) {
            const lines = doc.splitTextToSize(`: ${value}`, contentWidth - 40);
            doc.text(lines, margin + 38, y);
            y += lines.length * 4.5;
        } else {
            doc.text(`: ${value}`, margin + 38, y);
            y += 5.5;
        }
    }

    // ─── ACTIVITIES TABLE ─────────────────────────────────
    y += 6;

    // Check if we need a new page
    if (y > 200) {
        doc.addPage();
        y = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Daftar Kegiatan', margin, y);
    y += 2;

    if (data.activities.length > 0) {
        const tableData = data.activities.map((act) => [
            act.code || '-',
            act.activityName || '-',
            formatDate(act.startDate),
            formatDate(act.endDate),
            STATUS_LABELS[act.status] || act.status || '-',
            `${act.weight}%`,
        ]);

        // Add total row
        const totalWeight = data.activities.reduce((sum, a) => sum + a.weight, 0);
        tableData.push(['', 'TOTAL BOBOT', '', '', '', `${totalWeight.toFixed(1)}%`]);

        autoTable(doc, {
            startY: y,
            head: [['Kode', 'Nama Kegiatan', 'Mulai', 'Selesai', 'Status', 'Bobot']],
            body: tableData,
            margin: { left: margin, right: margin },
            styles: {
                fontSize: 8,
                cellPadding: 3,
                textColor: [15, 23, 42],
                lineColor: [226, 232, 240],
                lineWidth: 0.3,
            },
            headStyles: {
                fillColor: [16, 185, 129],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8,
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252], // slate-50
            },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 28 },
                3: { cellWidth: 28 },
                4: { cellWidth: 28 },
                5: { cellWidth: 18, halign: 'center' },
            },
            didParseCell: (hookData) => {
                // Style the total row
                if (hookData.row.index === tableData.length - 1 && hookData.section === 'body') {
                    hookData.cell.styles.fontStyle = 'bold';
                    hookData.cell.styles.fillColor = [241, 245, 249]; // slate-100
                }
            },
        });

        // Get the final Y position after the table
        y = (doc as any).lastAutoTable?.finalY || y + 30;
    } else {
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('Belum ada kegiatan yang ditambahkan.', margin, y);
    }

    // ─── S-CURVE CHART ───────────────────────────────────
    if (data.sCurveData && data.sCurveData.length > 1) {
        // New page for chart
        doc.addPage();
        y = margin;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('S-Curve', margin, y);
        y += 8;

        // Chart dimensions
        const chartX = margin;
        const chartY = y;
        const chartW = contentWidth;
        const chartH = 90;
        const points = data.sCurveData;

        // Draw chart background
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(chartX - 2, chartY - 2, chartW + 4, chartH + 20, 2, 2, 'F');

        // Draw grid lines (horizontal)
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.15);
        for (let pct = 0; pct <= 100; pct += 20) {
            const gy = chartY + chartH - (pct / 100) * chartH;
            doc.line(chartX, gy, chartX + chartW, gy);
            // Y-axis labels
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(`${pct}%`, chartX - 2, gy + 1.5, { align: 'right' });
        }

        // Draw axes
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(chartX, chartY, chartX, chartY + chartH); // Y axis
        doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH); // X axis

        const stepX = chartW / (points.length - 1);

        // Draw baseline line (blue)
        doc.setDrawColor(59, 130, 246); // blue-500
        doc.setLineWidth(0.8);
        for (let i = 1; i < points.length; i++) {
            const x1 = chartX + (i - 1) * stepX;
            const y1 = chartY + chartH - (points[i - 1].baseline / 100) * chartH;
            const x2 = chartX + i * stepX;
            const y2 = chartY + chartH - (points[i].baseline / 100) * chartH;
            doc.line(x1, y1, x2, y2);
        }

        // Draw actual line (emerald)
        const hasActual = points.some(p => p.actual > 0);
        if (hasActual) {
            doc.setDrawColor(16, 185, 129); // emerald-500
            doc.setLineWidth(0.8);
            const actualPoints = points.filter(p => p.actual > 0 || points.indexOf(p) === 0);
            for (let i = 1; i < points.length; i++) {
                if (points[i].actual === 0 && i > 0 && points[i - 1].actual === 0) continue;
                const x1 = chartX + (i - 1) * stepX;
                const y1 = chartY + chartH - (points[i - 1].actual / 100) * chartH;
                const x2 = chartX + i * stepX;
                const y2 = chartY + chartH - (points[i].actual / 100) * chartH;
                doc.line(x1, y1, x2, y2);
            }
        }

        // Draw data points
        for (let i = 0; i < points.length; i++) {
            const px = chartX + i * stepX;
            // Baseline dot
            doc.setFillColor(59, 130, 246);
            doc.circle(px, chartY + chartH - (points[i].baseline / 100) * chartH, 0.8, 'F');
            // Actual dot
            if (points[i].actual > 0 || i === 0) {
                doc.setFillColor(16, 185, 129);
                doc.circle(px, chartY + chartH - (points[i].actual / 100) * chartH, 0.8, 'F');
            }
        }

        // X-axis labels (show subset to avoid overlap)
        const maxLabels = 12;
        const labelInterval = Math.max(1, Math.ceil(points.length / maxLabels));
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        for (let i = 0; i < points.length; i += labelInterval) {
            const lx = chartX + i * stepX;
            doc.text(points[i].periodLabel, lx, chartY + chartH + 5, {
                align: 'center',
                angle: 45,
            });
        }

        // Legend
        const legendY = chartY + chartH + 14;
        // Baseline legend
        doc.setFillColor(59, 130, 246);
        doc.rect(chartX + chartW / 2 - 35, legendY - 2, 6, 2, 'F');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text('Baseline', chartX + chartW / 2 - 27, legendY);

        // Actual legend
        doc.setFillColor(16, 185, 129);
        doc.rect(chartX + chartW / 2 + 5, legendY - 2, 6, 2, 'F');
        doc.text('Realisasi', chartX + chartW / 2 + 13, legendY);

        y = legendY + 8;
    }

    // ─── SIGNATURE SECTION ────────────────────────────────
    const validSignatures = data.signatures.filter((s) => s.name.trim());

    if (validSignatures.length > 0) {
        // Check if we need a new page for signatures
        if (y > 210) {
            doc.addPage();
            y = margin;
        }

        y += 12;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        const sigColWidth = contentWidth / 2;
        const signatureTimestamp = new Date().toISOString();

        for (let i = 0; i < validSignatures.length; i++) {
            const sig = validSignatures[i];
            const colX = margin + i * sigColWidth;
            const centerX = colX + sigColWidth / 2;

            // Role title
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            doc.text(sig.role, centerX, y, { align: 'center' });

            // Generate verification hash
            const hashInput = `${data.id}|${sig.name}|${sig.role}|${signatureTimestamp}`;
            const verificationCode = await generateVerificationHash(hashInput);

            // Generate QR code
            const qrData = JSON.stringify({
                project: data.name,
                signedBy: sig.name,
                role: sig.role,
                date: signatureTimestamp,
                code: verificationCode,
            });

            const qrDataUrl = await generateQRDataURL(qrData);

            // Draw QR code
            const qrSize = 28;
            const qrX = centerX - qrSize / 2;
            doc.addImage(qrDataUrl, 'PNG', qrX, y + 4, qrSize, qrSize);

            // Signer name
            const nameY = y + 4 + qrSize + 5;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(sig.name, centerX, nameY, { align: 'center' });

            // Sign date
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(formatDate(signatureTimestamp), centerX, nameY + 5, { align: 'center' });

            // Verification code
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`Kode: ${verificationCode}`, centerX, nameY + 9, { align: 'center' });
        }
    }

    // ─── FOOTER ───────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
            `Halaman ${p} dari ${pageCount}  •  Dokumen ini digenerate otomatis oleh sistem Pertamina Foundation`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 8,
            { align: 'center' }
        );

        // Bottom accent bar
        doc.setFillColor(16, 185, 129);
        doc.rect(0, doc.internal.pageSize.getHeight() - 3, pageWidth, 3, 'F');
    }

    // ─── PREVIEW IN NEW TAB ──────────────────────────────
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    window.open(blobUrl, '_blank');
}
