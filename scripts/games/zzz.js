import { fetchNews } from './hoyolab-news.js'
// ponytail: banners/version empty; fill via data/manual/zzz.json
export async function buildFeed({ fetchJson, game }) {
  return {
    gameId: 'zzz', gameName: game.name, version: {},
    banners: [], events: [],
    news: await fetchNews({ fetchJson, gid: 8 }),
    syncedAt: new Date().toISOString(),
  }
}
