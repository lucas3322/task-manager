import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { __ORBITASK_DEFAULT_API_URL__: JSON.stringify(process.env.ORBITASK_API_URL ?? 'http://localhost:3000/api/v1') },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } } },
  },
  renderer: {
    resolve: { alias: { '@renderer': resolve('src/renderer') } },
    plugins: [react()],
  },
})
