// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Import Tailwind v4 plugin
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add Tailwind here
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sari-Sari Store POS',
        short_name: 'StorePOS',
        display: 'standalone',
      }
    })
  ]
})
