import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// In development the React app runs on Vite (port 5173) and forwards /api to
// the FastAPI backend on 8080. In production FastAPI serves the built files
// itself, so the browser talks to one origin and no CORS setup is needed.
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
