import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const traefik = 'http://127.0.0.1:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: traefik, changeOrigin: true },
      '/media': { target: traefik, changeOrigin: true },
    },
  },
})
