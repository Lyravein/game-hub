import { fetchNews } from './hoyolab-news.js'
// ponytail: banners/version empty; fill via data/manual/hsr.json
export async function buildFeed({ fetchJson, game }) {
  return {
    gameId: 'hsr', gameName: game.name, version: {},
    banners: [], events: [],
    news: await fetchNews({ fetchJson, gid: 6 }),
    syncedAt: new Date().toISOString(),
  }
}
