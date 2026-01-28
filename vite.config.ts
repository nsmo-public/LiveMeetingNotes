import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/LiveMeetingNotes/', // Đảm bảo đúng tên repo
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
        description: 'Voice Recording + AI-Powered Meeting Notes',
        theme_color: '#667eea',
        background_color: '#667eea',
        display: 'standalone',
        orientation: 'any',
        scope: '/LiveMeetingNotes/',
        start_url: '/LiveMeetingNotes/',
        icons: [
          {
            src: '/LiveMeetingNotes/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/LiveMeetingNotes/icons/icon-512.svg',
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
