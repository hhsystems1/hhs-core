import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssMinify: 'esbuild',
  },
  server: {
    host: '0.0.0.0',
    hmr: false,
    allowedHosts: ['.taile43c5b.ts.net', 'localhost', '127.0.0.1', '10.0.0.76'],
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
