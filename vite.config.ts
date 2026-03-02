import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/SlingSquad/',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 3000,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
}))
