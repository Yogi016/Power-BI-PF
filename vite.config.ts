import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [tailwindcss(), react(), VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Fav-Icon.jpeg', 'pf-logo.png', 'logo_putih.png'],
      manifest: {
        name: 'ProTrack - Sistem Pemantauan Progress',
        short_name: 'ProTrack',
        description: 'Sistem pemantauan progress project Pertamina Foundation',
        theme_color: '#1e40af',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'Fav-Icon.jpeg',
            sizes: '192x192',
            type: 'image/jpeg',
          },
          {
            src: 'Fav-Icon.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
          },
          {
            src: 'Fav-Icon.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        navigateFallback: 'index.html',
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
            },
          },
        ],
      },
    })],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Keep the React runtime (and the Vite preload helper that colocates
            // with it) in a dedicated, always-loaded chunk. Without this, Rollup
            // hoists react-dom into whichever vendor group it links first
            // (previously vendor-calendar), forcing the entire calendar/moment
            // bundle onto the initial critical path — even on the Login screen.
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/') ||
              id.includes('node_modules/react-is/') ||
              // Pin Vite's __vitePreload helper to the always-loaded react
              // chunk. Otherwise Rollup colocates it inside vendor-pdf, forcing
              // the entry to statically import (and modulepreload) the 1.5 MB
              // PDF bundle on first paint.
              id.includes('vite/preload-helper') ||
              // Pin Rollup's shared CommonJS interop helpers here too. They are
              // tiny but get imported by react/supabase; if they land in a heavy
              // CJS vendor (moment/calendar) they drag that whole chunk onto the
              // initial preload path.
              id.includes('commonjsHelpers') ||
              id.includes('commonjs-dynamic-modules') ||
              id.includes('\0commonjs')
            ) {
              return 'vendor-react';
            }
            // Group recharts into its own vendor chunk
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
              return 'vendor-recharts';
            }
            // Group Supabase SDK
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase';
            }
            // Group PDF libraries (jspdf, pdf-lib, pdfjs-dist)
            if (
              id.includes('node_modules/jspdf') ||
              id.includes('node_modules/pdf-lib') ||
              id.includes('node_modules/pdfjs-dist') ||
              id.includes('node_modules/html2canvas')
            ) {
              return 'vendor-pdf';
            }
            // Group calendar libraries
            if (
              id.includes('node_modules/react-big-calendar') ||
              id.includes('node_modules/moment')
            ) {
              return 'vendor-calendar';
            }
            // Group lucide icons into one chunk instead of 30+ tiny files
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            // Group xlsx
            if (id.includes('node_modules/xlsx')) {
              return 'vendor-xlsx';
            }
            // Group DnD
            if (id.includes('node_modules/react-dnd')) {
              return 'vendor-dnd';
            }
          },
        },
      },
    },
  };
});