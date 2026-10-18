import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// All data comes from api_server.py (python api_server.py, port 8000).
// GitHub Pages serves the site from /<repo>/, so the Pages workflow sets VITE_BASE.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
});
