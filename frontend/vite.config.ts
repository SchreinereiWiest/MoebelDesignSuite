import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const rootEnvDir = path.resolve(import.meta.dirname, '..')
  const env = loadEnv(mode, rootEnvDir, '')

  return {
    envDir: rootEnvDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: process.env.VITE_DEV_API_PROXY || env.VITE_DEV_API_PROXY || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
