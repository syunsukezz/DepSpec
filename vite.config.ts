import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    middlewareMode: false,
    proxy: {
      '/api': {
        target: 'https://meigen.doodlenote.net',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    },
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  },
  // 静的ファイルの圧縮を無効化（.gz ファイルは既に圧縮済み）
  build: {
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
})