import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Assets in public/ that should be precached alongside the build output.
      includeAssets: ['logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'TAP - APDC Attendance System',
        short_name: 'TAP',
        description: 'IoT-enabled time and attendance platform using NFC technology.',
        theme_color: '#1b2a4a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache the built app shell (JS/CSS/HTML/images/fonts).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // SPA fallback so deep links work offline, but never hijack API calls.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/apdc\/backend/],
        runtimeCaching: [
          {
            // Auth and all backend API traffic: ALWAYS go to the network first.
            // Never serve a cached login/session response. Falls back to cache
            // only if the network is unreachable, with a short-lived entry.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api') ||
              /up\.railway\.app\/api/.test(url.href),
            handler: 'NetworkOnly',
            method: 'GET',
            options: {
              cacheName: 'api-no-store',
            },
          },
          {
            // Google / CDN fonts and Font Awesome: fine to cache long-term.
            urlPattern: ({ url }) =>
              url.origin === 'https://cdnjs.cloudflare.com' ||
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'external-assets',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      devOptions: {
        // Keep the SW off during `npm run dev` to avoid caching surprises
        // while developing. It is active in the production build.
        enabled: false,
      },
    }),
  ],
  server: {
    host: true, // Listen on all interfaces so a phone on the LAN can reach the dev server.
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:80',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/apdc/backend/api'),
      }
    }
  }
})
