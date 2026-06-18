import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ganntlensApi } from './server/createDevPlugin.mjs'

// GitHub Pages: repo 是 cailleachzou/ganntlens，所以 base = '/ganntlens/'
// 本地 dev 不受影响（Vite 会用 root path 处理 dev server）
export default defineConfig({
  base: '/ganntlens/',
  plugins: [react(), ganntlensApi()],
  server: {
    port: 5173,
    host: true
  }
})
