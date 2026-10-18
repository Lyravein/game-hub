export default defineNuxtConfig({
  compatibilityDate: '2026-10-18',
  srcDir: 'app/',
  css: ['@fontsource/outfit/400.css', '@fontsource/outfit/600.css', '@fontsource/outfit/700.css', '~/assets/css/main.css'],
  nitro: { preset: 'node-server' },
})
