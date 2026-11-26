import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Regroupe les dépendances lourdes en chunks séparés (meilleur cache navigateur).
 * Vite 8 (Rolldown) exige une fonction : la forme objet faisait échouer le build.
 * @param {string} id - chemin du module
 * @returns {string|undefined} nom du chunk
 */
function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  if (/[\\/]node_modules[\\/](recharts|d3-|victory-vendor)/.test(id)) return 'chart-vendor';
  if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
  if (/[\\/]node_modules[\\/](axios|papaparse)[\\/]/.test(id)) return 'utils';
  return undefined;
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 3000,
    // En dev, '/api' est relayé au backend : même origine, pas de CORS, cookie SameSite=strict OK
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Pas de sourcemaps publiques en production (exposerait le code source)
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: { manualChunks },
    },
    chunkSizeWarningLimit: 1000,
  },
  // Tests : Vitest + jsdom (npm test)
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'recharts', 'axios'],
  },
}));
