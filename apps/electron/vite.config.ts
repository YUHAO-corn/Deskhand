import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
})
