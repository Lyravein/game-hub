import { fetchNews } from './hoyolab-news.js'
// ponytail: banners/version empty (no free reliable source yet); fill via data/manual/genshin.json
export async function buildFeed({ fetchJson, game }) {
  return {
    gameId: 'genshin', gameName: game.name, version: {},
    banners: [], events: [],
    news: await fetchNews({ fetchJson, gid: 2 }),
    syncedAt: new Date().toISOString(),
  }
}
