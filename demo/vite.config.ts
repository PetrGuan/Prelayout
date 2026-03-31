import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'landing.html'),
        comparison: resolve(__dirname, 'comparison.html'),
        accuracy: resolve(__dirname, 'accuracy.html'),
        benchmark: resolve(__dirname, 'benchmark.html'),
        showcase: resolve(__dirname, 'showcase.html'),
        stress: resolve(__dirname, 'stress.html'),
        probe: resolve(__dirname, 'probe.html'),
        'auto-calibrate': resolve(__dirname, 'auto-calibrate.html'),
        extract: resolve(__dirname, 'extract.html'),
        accordion: resolve(__dirname, 'accordion.html'),
        masonry: resolve(__dirname, 'masonry.html'),
        chat: resolve(__dirname, 'chat.html'),
        table: resolve(__dirname, 'table.html'),
        playground: resolve(__dirname, 'playground.html'),
        truncate: resolve(__dirname, 'truncate.html'),
      },
    },
  },
})
