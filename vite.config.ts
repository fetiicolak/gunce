import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// GitHub Pages'te uygulama /<repo-adı>/ altında yayınlanır
const base = process.env.VITE_BASE ?? '/gunce/'

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
  build: {
    rolldownOptions: {
      output: {
        // Kütüphaneleri ayrı dosyalara böl: tek 600+ kB'lık dosya yerine paralel ve ayrı önbelleklenen parçalar
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/ },
            { name: 'supabase', test: /node_modules[\/]@supabase[\/]/ },
            { name: 'dnd', test: /node_modules[\/]@dnd-kit[\/]/ },
            { name: 'vendor', test: /node_modules[\/]/ },
          ],
        },
      },
    },
  },
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mp3}'],
        // Eklenti service worker'ı eski `inlineDynamicImports` ayarıyla derliyor; Vite 8 (Rolldown) bunu
        // kullanımdan kaldırdı. Aynı anlamdaki `codeSplitting: false` ile değiştir ki derleme uyarısı çıkmasın.
        buildPlugins: {
          vite: [
            {
              name: 'sw-code-splitting',
              config(c) {
                const out = c.build?.rollupOptions?.output as Record<string, unknown> | undefined
                if (out && !Array.isArray(out) && 'inlineDynamicImports' in out) {
                  delete out.inlineDynamicImports
                  out.codeSplitting = false
                }
              },
            },
          ],
        },
      },
      manifest: {
        name: 'Günce',
        short_name: 'Günce',
        description: 'Görevler, hatırlatmalar ve takvim',
        lang: 'tr',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f6f7fb',
        theme_color: '#2f5fd0',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
