import { S3Client } from '@aws-sdk/client-s3';

// Pastikan Anda mengisi kredensial ini di file .env.local
const accountId = import.meta.env.VITE_R2_ACCOUNT_ID;
const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;

// S3 Client untuk berinteraksi dengan Cloudflare R2
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
      accessKeyId: accessKeyId || '',
      secretAccessKey: secretAccessKey || '',
  },
});
