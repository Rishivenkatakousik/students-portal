import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Dev: Vite (:5173) forwards /api to FastAPI (:8080). Production: FastAPI serves the build.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      // FastAPI's interactive API docs, linked from the header.
      '/docs': 'http://localhost:8080',
      '/openapi.json': 'http://localhost:8080',
    },
  },
})
