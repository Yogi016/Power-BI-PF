import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateSignatureQROnly } from './generateSignatureQR';

export interface SignatureStamp {
    signerName: string;
    signerRole: string;
    verificationCode: string;
    positionX: number; // 0-1 relative to page width
    positionY: number; // 0-1 relative to page height
    pageNumber: number; // 1-indexed
    signDate: string;
    scale?: number; // 0.4-2.5, default 1.0
}

/**
 * Apply signature stamps to an existing PDF.
 * Returns a new PDF blob with signatures embedded.
 */
export async function applySignaturesToPDF(
    pdfBytes: ArrayBuffer,
    signatures: SignatureStamp[]
): Promise<Blob> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const sig of signatures) {
        const pageIndex = sig.pageNumber - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;

        const page = pages[pageIndex];
        const { width, height } = page.getSize();

        const scale = sig.scale || 1.0;

        // Stamp dimensions (scaled)
        const stampWidth = 160 * scale;
        const stampHeight = 160 * scale;
        const x = sig.positionX * width;
        const y = height - sig.positionY * height - stampHeight; // PDF coords are bottom-up

        // Draw signature border
        page.drawRectangle({
            x,
            y,
            width: stampWidth,
            height: stampHeight,
            borderColor: rgb(0.85, 0.85, 0.85),
            borderWidth: 0.5,
            color: rgb(1, 1, 1),
            opacity: 0.95,
        });

        // Generate QR with logo
        const qrDataUrl = await generateSignatureQROnly({
            verificationCode: sig.verificationCode,
        });

        // Embed QR image
        const qrImageBytes = await fetch(qrDataUrl).then(r => r.arrayBuffer());
        const qrImage = await pdfDoc.embedPng(qrImageBytes);
        const qrSize = 80 * scale;
        const qrX = x + (stampWidth - qrSize) / 2;
        const qrY = y + stampHeight - qrSize - 8 * scale;

        page.drawImage(qrImage, {
            x: qrX,
            y: qrY,
            width: qrSize,
            height: qrSize,
        });

        // Signer name
        const nameSize = 8 * scale;
        const nameWidth = helveticaBold.widthOfTextAtSize(sig.signerName, nameSize);
        page.drawText(sig.signerName, {
            x: x + (stampWidth - nameWidth) / 2,
            y: qrY - 14 * scale,
            size: nameSize,
            font: helveticaBold,
            color: rgb(0.06, 0.09, 0.16),
        });

        // Signer role
        const roleSize = 7 * scale;
        const roleWidth = helvetica.widthOfTextAtSize(sig.signerRole, roleSize);
        page.drawText(sig.signerRole, {
            x: x + (stampWidth - roleWidth) / 2,
            y: qrY - 26 * scale,
            size: roleSize,
            font: helvetica,
            color: rgb(0.28, 0.33, 0.41),
        });

        // Verification code
        const codeStr = `Kode: ${sig.verificationCode}`;
        const codeSize = 5.5 * scale;
        const codeWidth = helvetica.widthOfTextAtSize(codeStr, codeSize);
        page.drawText(codeStr, {
            x: x + (stampWidth - codeWidth) / 2,
            y: qrY - 38 * scale,
            size: codeSize,
            font: helvetica,
            color: rgb(0.39, 0.45, 0.55),
        });
    }

    const modifiedPdfBytes = await pdfDoc.save();
    return new Blob([modifiedPdfBytes as any], { type: 'application/pdf' });
}

function formatDateIndo(iso: string): string {
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
