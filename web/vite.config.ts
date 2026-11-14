import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: { planner: 'index.html', map: 'map/index.html', overview: 'overview/index.html' }
    }
  },
  server: {
    host: 'localhost',
    port: 5173
  }
});
