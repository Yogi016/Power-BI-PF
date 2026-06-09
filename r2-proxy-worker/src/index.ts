/**
 * Secure R2 Proxy Worker
 * Mengizinkan front-end melakukan upload/delete tanpa mengekspos kredensial R2 di browser.
 * Dilengkapi dengan validasi CORS yang ketat.
 */

export interface Env {
  // Binding ke R2 Bucket yang didefinisikan di wrangler.toml
  MY_BUCKET: R2Bucket;
}

const ALLOWED_ORIGINS = [
  'https://project-lingkungan.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173' // Vercel Preview/Vite Preview
];

const MAX_UPLOAD_SIZE_MB = 300;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': (origin && ALLOWED_ORIGINS.includes(origin)) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

function isOriginAllowed(origin: string | null) {
  // Jika origin kosong (bukan browser), kita bisa blokir 
  // atau izinkan (misal server to server). 
  // Untuk keamanan ekstra karena ini front-end only, kita wajibkan origin yang dikenali.
  if (!origin) return false; 
  return ALLOWED_ORIGINS.includes(origin);
}

function payloadTooLargeResponse(origin: string | null) {
  return new Response(`Payload Too Large: maksimal ${MAX_UPLOAD_SIZE_MB}MB`, {
    status: 413,
    headers: corsHeaders(origin)
  });
}

function limitUploadSize(body: ReadableStream<Uint8Array> | null) {
  if (!body) return body;

  let uploadedBytes = 0;
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      uploadedBytes += chunk.byteLength;
      if (uploadedBytes > MAX_UPLOAD_SIZE_BYTES) {
        controller.error(new Error('payload_too_large'));
        return;
      }
      controller.enqueue(chunk);
    }
  }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);
    let key: string;
    try {
      key = decodeURIComponent(url.pathname.slice(1)); // Normalisasi "%20" kembali menjadi spasi pada key R2
    } catch {
      return new Response('Bad Request: path tidak valid', {
        status: 400,
        headers: corsHeaders(origin)
      });
    }

    // 1. Tangani CORS Preflight (Browser mengecek izin sebelum upload)
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // 2. Validasi Origin (Mencegah web lain mencuri kuota upload Anda)
    if (!isOriginAllowed(origin)) {
      return new Response('Forbidden: Tidak dikenali atau origin bukan Vercel/Localhost Anda', { 
        status: 403, 
        headers: corsHeaders(origin) 
      });
    }

    // 3. Mencegah manipulasi root namespace
    if (!key) {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'PUT', ...corsHeaders(origin) }
      });
    }

    // 4. Tangani UPLOAD (PUT)
    if (request.method === 'PUT') {
      const contentType = request.headers.get('content-type') || 'application/octet-stream';
      const contentLength = request.headers.get('content-length');
      if (contentLength && Number(contentLength) > MAX_UPLOAD_SIZE_BYTES) {
        return payloadTooLargeResponse(origin);
      }
      
      // Simpan file stream langsung ke R2! 100% aman, credential R2 diamankan oleh server Cloudflare.
      try {
        await env.MY_BUCKET.put(key, limitUploadSize(request.body), {
          httpMetadata: { contentType: contentType }
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'payload_too_large') {
          return payloadTooLargeResponse(origin);
        }
        throw error;
      }
      
      return new Response(JSON.stringify({ success: true, key }), { 
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } 
      });
    }

    // 5. Tangani DELETE (REMOVE)
    if (request.method === 'DELETE') {
       await env.MY_BUCKET.delete(key);
       return new Response(JSON.stringify({ success: true, deleted: key }), { 
         headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } 
       });
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'PUT, DELETE, OPTIONS', ...corsHeaders(origin) },
    });
  },
};
