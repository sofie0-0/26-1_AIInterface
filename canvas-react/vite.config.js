import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@google/genai'))          return 'vendor-ai';
          if (id.includes('framer-motion'))          return 'vendor-motion';
          if (
            id.includes('react-markdown') ||
            id.includes('rehype-raw')     ||
            id.includes('rehype-sanitize')
          ) return 'vendor-markdown';
          if (
            id.includes('react-dom')      ||
            id.includes('react-router')   ||
            id.includes('/react/')        ||
            id.includes('/react/index')
          ) return 'vendor-react';
        },
      },
    },
  },
})
