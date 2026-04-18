import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

// 1. Setup config
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const accountId = process.env.VITE_R2_ACCOUNT_ID!;
const accessKeyId = process.env.VITE_R2_ACCESS_KEY_ID!;
const secretAccessKey = process.env.VITE_R2_SECRET_ACCESS_KEY!;
const bucketName = process.env.VITE_R2_BUCKET_NAME!;
const publicUrlBase = process.env.VITE_R2_PUBLIC_URL!;

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

// Helper Function
async function downloadFileFromUrl(url: string): Promise<{ buffer: Uint8Array, contentType: string } | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const arrayBuffer = await response.arrayBuffer();
        return { buffer: new Uint8Array(arrayBuffer), contentType };
    } catch(e) {
        return null;
    }
}

async function uploadBufferToR2(filePath: string, buffer: Uint8Array, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: contentType,
    });
    await r2Client.send(command);
    return `${publicUrlBase}/${filePath}`;
}

async function migrateDocuments() {
    console.log("=== MIGRATING DOCUMENTS ===");
    const { data: documents, error } = await supabase.from('documents').select('id, link, category_id, no_surat');
    if (error) {
        console.error("Error fetching documents", error);
        return;
    }

    if (!documents) return;

    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        if (!doc.link || !doc.link.includes('supabase.co')) {
            continue; // Skip already migrated or external links
        }

        console.log(`[DOC ${i+1}/${documents.length}] Migrating: ${doc.no_surat}`);
        
        try {
            // Download
            const fileData = await downloadFileFromUrl(doc.link);
            if (!fileData) {
                console.error(`  -> Failed to download: ${doc.link}`);
                continue;
            }

            // Extract path from supabase url. Format: .../storage/v1/object/public/dokumen/<path>
            const marker = '/storage/v1/object/public/dokumen/';
            const idx = doc.link.indexOf(marker);
            let filePath = `migrated_dokumen/${Date.now()}_file.pdf`; // fallback
            
            if (idx !== -1) {
                filePath = decodeURIComponent(doc.link.substring(idx + marker.length));
            } else {
                // Not standard bucket path, handle properly
                filePath = `dokumen/${Date.now()}_${doc.id}`;
            }

            // Upload
            const newUrl = await uploadBufferToR2(filePath, fileData.buffer, fileData.contentType);

            // Update DB
            const { error: updateErr } = await supabase.from('documents').update({ link: newUrl }).eq('id', doc.id);
            if (updateErr) throw updateErr;

            console.log(`  -> Sukses: ${newUrl}`);
        } catch (err: any) {
             console.error(`  -> Error processing doc ${doc.id}:`, err.message);
        }
    }
}

async function migrateActivities() {
    console.log("\n=== MIGRATING ACTIVITIES EVIDENCE ===");
    const { data: activities, error } = await supabase.from('activities').select('id, evidence, activity_name, project_id');
    if (error) {
        console.error("Error fetching activities", error);
        return;
    }

    if (!activities) return;

    for (let i = 0; i < activities.length; i++) {
        const act = activities[i];
        if (!act.evidence || act.evidence === '[]') continue;

        let evidenceArr: string[] = [];
        try {
            evidenceArr = JSON.parse(act.evidence);
        } catch(e) {
            continue; // Invalid JSON
        }

        let isUpdated = false;
        const newEvidenceArr: string[] = [];

        for (const url of evidenceArr) {
            if (!url.includes('supabase.co')) {
                newEvidenceArr.push(url); // Keep existing external/R2 link
                continue;
            }

            console.log(`[ACT ${i+1}/${activities.length}] Migrating Evidence: ${act.id}`);
            
            try {
                const fileData = await downloadFileFromUrl(url);
                if (!fileData) {
                    console.error(`  -> Failed to download: ${url}`);
                    newEvidenceArr.push(url); // Keep original if failed
                    continue;
                }

                const marker = '/storage/v1/object/public/evidence/';
                const idx = url.indexOf(marker);
                let filePath = `migrated_evidence/${Date.now()}_img.jpg`;
                
                if (idx !== -1) {
                    filePath = decodeURIComponent(url.substring(idx + marker.length));
                } else {
                    filePath = `${act.project_id}/${Date.now()}_migrated.jpg`;
                }

                const newUrl = await uploadBufferToR2(filePath, fileData.buffer, fileData.contentType);
                newEvidenceArr.push(newUrl);
                isUpdated = true;
                console.log(`  -> Sukses: ${newUrl}`);
            } catch (err: any) {
                console.error(`  -> Error processing url ${url}:`, err.message);
                newEvidenceArr.push(url); // Keep original if failed
            }
        }

        if (isUpdated) {
            const { error: updateErr } = await supabase
                .from('activities')
                .update({ evidence: JSON.stringify(newEvidenceArr) })
                .eq('id', act.id);
                
            if (updateErr) {
                console.error(`  -> Gagal update DB untuk ACT ${act.id}`);
            } else {
                 console.log(`  -> Row DB Updated!`);
            }
        }
    }
}

async function main() {
    console.log("Memulai Migrasi Data. Mohon tunggu...\n");
    await migrateDocuments();
    await migrateActivities();
    console.log("\n⚡ MIGRASI SELESAI!");
}

main().catch(console.error);
