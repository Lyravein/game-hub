export default defineNuxtConfig({
  compatibilityDate: '2026-10-18',
  srcDir: 'app/',
  // App hidup di bawah prefix path ini (Cloudflare Tunnel meneruskan path apa adanya, tidak dipotong).
  app: {
    baseURL: '/game-hub/',
    head: {
      title: '🎮 Lyravein Game Hub',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/game-hub/favicon.svg' }
      ]
    }
  },
  css: ['@fontsource/outfit/400.css', '@fontsource/outfit/600.css', '@fontsource/outfit/700.css', '~/assets/css/main.css'],
  nitro: { preset: 'node-server' },
})
