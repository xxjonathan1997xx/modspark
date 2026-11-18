import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const productionCsp = {
  name: 'modspark-production-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const marker = '<!-- MODSPARK_PRODUCTION_CSP -->'
    if (!html.includes(marker)) throw new Error('Production CSP marker is missing from index.html')
    return html.replace(marker, '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https://cdn.cloudflare.steamstatic.com">')
  },
}

export default defineConfig({
  plugins: [react(), productionCsp],
  base: './',
  server: { port: 5173, strictPort: true },
})
