import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import nodePolyfills from 'rollup-plugin-polyfill-node'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), nodePolyfills()],
  build: {
    rollupOptions: {
      plugins: [nodePolyfills()],
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})