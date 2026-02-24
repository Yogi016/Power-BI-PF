import QRCode from 'qrcode';

/**
 * Generate a QR code with PF logo overlay in the center.
 * The QR encodes a verification URL.
 * Returns a composite image data URL with QR + signer info.
 */
export async function generateSignatureQR(params: {
    signerName: string;
    signerRole: string;
    signDate: string;
    verificationCode: string;
    appUrl?: string;
}): Promise<string> {
    const {
        signerName,
        signerRole,
        signDate,
        verificationCode,
        appUrl = window.location.origin,
    } = params;

    // QR data is a verification URL
    const verifyUrl = `${appUrl}?verify=${verificationCode}`;

    // Generate base QR code
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'H', // High error correction to survive logo overlay
        color: { dark: '#1e293b', light: '#ffffff' },
    });

    // Create canvas to composite QR + logo + text
    const canvas = document.createElement('canvas');
    const canvasWidth = 240;
    const canvasHeight = 290;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw QR code
    const qrImg = await loadImage(qrDataUrl);
    const qrSize = 200;
    const qrX = (canvasWidth - qrSize) / 2;
    const qrY = 10;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Overlay PF logo in center of QR
    try {
        const logoImg = await loadImage('/pf-logo.png');
        const logoSize = 48;
        const logoX = qrX + (qrSize - logoSize) / 2;
        const logoY = qrY + (qrSize - logoSize) / 2;

        // White circle background for logo
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } catch {
        // Logo failed to load, continue without it
    }

    // Draw signer info below QR
    const textStartY = qrY + qrSize + 16;

    // Name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(signerName, canvasWidth / 2, textStartY);

    // Role
    ctx.fillStyle = '#475569';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(signerRole, canvasWidth / 2, textStartY + 20);

    // Verification code
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText(`Kode: ${verificationCode}`, canvasWidth / 2, textStartY + 38);

    return canvas.toDataURL('image/png');
}

/**
 * Generate just the QR code with logo overlay (no text) for PDF embedding
 */
export async function generateSignatureQROnly(params: {
    verificationCode: string;
    appUrl?: string;
}): Promise<string> {
    const { verificationCode, appUrl = window.location.origin } = params;
    const verifyUrl = `${appUrl}?verify=${verificationCode}`;

    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#1e293b', light: '#ffffff' },
    });

    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;

    const qrImg = await loadImage(qrDataUrl);
    ctx.drawImage(qrImg, 0, 0, 200, 200);

    // Overlay logo
    try {
        const logoImg = await loadImage('/pf-logo.png');
        const logoSize = 48;
        const logoX = (200 - logoSize) / 2;
        const logoY = (200 - logoSize) / 2;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(100, 100, logoSize / 2 + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } catch {
        // Continue without logo
    }

    return canvas.toDataURL('image/png');
}

/**
 * Generate a unique verification code
 */
export function generateVerificationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];
    for (let s = 0; s < 3; s++) {
        let segment = '';
        for (let i = 0; i < 4; i++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        segments.push(segment);
    }
    return segments.join('-'); // e.g. "A3F2-B8K1-C4M7"
}

// Helpers

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function formatSignDate(iso: string): string {
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
