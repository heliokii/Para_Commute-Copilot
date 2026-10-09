import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered by hand in src/main.tsx via virtual:pwa-register.
      injectRegister: false,
      manifestFilename: 'manifest.json',
      // Icons are already matched by workbox.globPatterns.
      includeManifestIcons: false,
      manifest: {
        name: 'Para! Offline Commute Helper',
        short_name: 'Para!',
        description: 'Taglish commute helper that works with no signal.',
        lang: 'fil',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#F5F0E6',
        background_color: '#F5F0E6',
        // Placeholder icons. Replace before branding.
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Whole app shell plus self-hosted fonts.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
