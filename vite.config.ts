import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/LiveMeetingNotes/', // GitHub Pages base URL
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      base: '/LiveMeetingNotes/',
      scope: '/LiveMeetingNotes/',
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: 'Live Meeting Notes',
        short_name: 'MeetingNotes',
        description: 'Record meetings with timestamps - Works Offline',
        theme_color: '#1e1e1e',
        background_color: '#1e1e1e',
        display: 'standalone',
        orientation: 'any',
        scope: '/LiveMeetingNote-Web/',
        start_url: '/LiveMeetingNote-Web/',
        icons: [
          {
            src: '/LiveMeetingNote-Web/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/LiveMeetingNote-Web/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false
  }
});
