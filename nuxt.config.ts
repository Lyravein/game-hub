export default defineNuxtConfig({
  compatibilityDate: '2026-10-18',
  srcDir: 'app/',
  // App hidup di bawah prefix path ini (Cloudflare Tunnel meneruskan path apa adanya, tidak dipotong).
  app: { baseURL: '/game-hub/' },
  css: ['@fontsource/outfit/400.css', '@fontsource/outfit/600.css', '@fontsource/outfit/700.css', '~/assets/css/main.css'],
  nitro: { preset: 'node-server' },
})
