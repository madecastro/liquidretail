import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for the new SPA. Builds to ./dist; the existing
// client/ static files keep deploying separately during cohabitation.
//
// During local dev, /api/* and /auth/* requests are proxied to the
// backend so we don't need CORS exemptions while iterating.
// Production deploy targets the same Render backend the existing
// vanilla pages use.

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'https://liquidretail-backend.onrender.com';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api':  { target: BACKEND_URL, changeOrigin: true, secure: true },
      '/auth': { target: BACKEND_URL, changeOrigin: true, secure: true }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
