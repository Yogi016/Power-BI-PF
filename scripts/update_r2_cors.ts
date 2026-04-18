/**
 * Script: Update CORS Policy di Cloudflare R2
 *
 * Script ini dijalankan OTOMATIS sebelum setiap `npm run build` (lihat prebuild di package.json).
 * Juga bisa dijalankan manual: npm run cors:update
 *
 * Cara kerja:
 * - Jika VITE_CF_API_TOKEN tersedia di env → update CORS otomatis via Cloudflare API
 * - Jika tidak ada token → generate file cors_policy.json untuk ditempel manual
 * - Jika VITE_APP_URL tidak ada → skip (tidak memblokir proses build)
 *
 * Untuk automasi penuh saat deploy ke Vercel:
 * 1. Tambahkan VITE_CF_API_TOKEN ke Vercel Environment Variables
 *    (buat di https://dash.cloudflare.com/profile/api-tokens, pilih "Cloudflare R2: Edit")
 * 2. Setiap kali Anda push ke GitHub, CORS otomatis diupdate sesuai VITE_APP_URL
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const accountId = process.env.VITE_R2_ACCOUNT_ID!;
const bucketName = process.env.VITE_R2_BUCKET_NAME!;
const appUrl = process.env.VITE_APP_URL!;
const cfApiToken = process.env.VITE_CF_API_TOKEN;

if (!accountId || !bucketName || !appUrl) {
  console.warn('⚠️  [CORS Update] VITE_APP_URL atau R2 config tidak ditemukan — dilewati, build tetap lanjut.');
  process.exit(0); // Exit 0 = tidak memblokir build
}

const allowedOrigins = [appUrl];

// Juga izinkan localhost untuk development jika URL saat ini adalah production
if (!appUrl.includes('localhost')) {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:4173');
}

async function updateCorsPolicyViaApi() {
  if (!cfApiToken) {
    // Jika tidak ada CF API Token, generate CORS JSON untuk ditempel manual
    generateCorsJson();
    return;
  }

  console.log(`\n🔧 Menerapkan CORS Policy ke bucket: "${bucketName}" via Cloudflare API...`);
  console.log(`   Allowed Origins:`);
  allowedOrigins.forEach(o => console.log(`     - ${o}`));

  const corsRules = allowedOrigins.map(origin => ({
    allowed: {
      origins: [origin],
      methods: ['GET', 'PUT', 'DELETE', 'HEAD'],
      headers: ['*'],
    },
    exposeHeaders: ['ETag'],
    maxAgeSeconds: 3600,
  }));

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/cors`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${cfApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rules: corsRules }),
      }
    );

    const json = await response.json() as any;

    if (json.success) {
      console.log(`\n✅ Berhasil! CORS Policy sudah diterapkan.`);
      console.log(`   Bucket "${bucketName}" sekarang hanya mengizinkan akses dari:`);
      allowedOrigins.forEach(o => console.log(`   → ${o}`));
    } else {
      console.error(`\n❌ Gagal:`, JSON.stringify(json.errors, null, 2));
      console.log('\n💡 Coba jalankan tanpa VITE_CF_API_TOKEN untuk mendapatkan CORS JSON manual.');
    }
  } catch (err: any) {
    console.error('❌ Error:', err.message);
  }
}

function generateCorsJson() {
  const corsJson = allowedOrigins.map(origin => ({
    AllowedOrigins: [origin],
    AllowedMethods: ['GET', 'PUT', 'DELETE', 'HEAD'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3600,
  }));

  const outputPath = 'scripts/cors_policy.json';
  fs.writeFileSync(outputPath, JSON.stringify(corsJson, null, 2));

  console.log(`\n✅ File CORS Policy telah dibuat: ${outputPath}`);
  console.log(`\n📋 Langkah selanjutnya (paste manual di Cloudflare Dashboard):`);
  console.log(`   1. Buka https://dash.cloudflare.com/`);
  console.log(`   2. R2 Object Storage → ${bucketName} → Settings → CORS Policy`);
  console.log(`   3. Copy-paste isi file "${outputPath}" ke dalam kotak CORS Policy`);
  console.log(`   4. Klik Save\n`);
  console.log('\n📄 Preview CORS Policy yang akan ditempel:');
  console.log(JSON.stringify(corsJson, null, 2));
  console.log('\n💡 Tips: Untuk otomasi penuh, tambahkan VITE_CF_API_TOKEN ke .env.local');
  console.log('   (buat di https://dash.cloudflare.com/profile/api-tokens, pilih "Cloudflare R2: Edit")\n');
}

updateCorsPolicyViaApi();
