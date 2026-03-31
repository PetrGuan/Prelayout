import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'landing.html'),
        main: resolve(__dirname, 'index.html'),
        accuracy: resolve(__dirname, 'accuracy.html'),
        benchmark: resolve(__dirname, 'benchmark.html'),
        showcase: resolve(__dirname, 'showcase.html'),
        stress: resolve(__dirname, 'stress.html'),
        probe: resolve(__dirname, 'probe.html'),
      },
    },
  },
})
