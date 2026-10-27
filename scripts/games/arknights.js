// Arknights EN (YoStar): events and gacha pools from ArknightsAssets/ArknightsGamedata (master),
// news from the official website API (www.arknights.global/api/resource/news/list).
// The gamedata dump carries no banner art and no rate-up list, and it lists no dates for the
// next version; those stay empty and data/manual/arknights.json can override them.
const BASE = 'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel'
const NEWS_API = 'https://www.arknights.global/api/resource/news/list?index=1&size=12&type=latest'
const SKIP_TYPES = new Set([
  'CHECKIN_ONLY', 'LOGIN_ONLY', 'CHECKIN_ACCESS', 'PRAY_ONLY', 'CHECKIN_VS',
  'CHECKIN_ALL_PLAYER', 'CHECKIN_VIDEO', 'SWITCH_ONLY', 'UNIQUE_ONLY', 'MISSION_ONLY',
])
// Weekly rotating pools and the permanent returning pool are not announced banners.
const SKIP_RULES = new Set(['DOUBLE', 'CLASSIC_DOUBLE', 'FESCLASSIC', 'CLASSIC_ATTAIN', 'RETURN'])
const SKIP_POOL_NAME = /rare operators|returning headhunting/i
const MAX_POOL_DAYS = 120

export async function buildFeed({ fetchJson, game }) {
  const [act, gacha, newsRes] = await Promise.all([
    fetchJson(`${BASE}/activity_table.json`),
    fetchJson(`${BASE}/gacha_table.json`),
    fetchJson(NEWS_API).catch(() => null),
  ])
  const now = Date.now()

  const events = Object.values(act.basicInfo ?? {})
    .filter(a => a?.name && a.startTime && a.endTime && !SKIP_TYPES.has(a.type) && !a.isReplicate)
    .map(a => ({ name: a.name, startsAt: new Date(a.startTime * 1000).toISOString(), endsAt: new Date(a.endTime * 1000).toISOString(), rewards: [], url: '' }))
    .filter(e => Date.parse(e.endsAt) > now)
    .sort((x, y) => Date.parse(x.endsAt) - Date.parse(y.endsAt))
    .slice(0, 10)

  const banners = (gacha.gachaPoolClient ?? [])
    .filter(p => p?.gachaPoolName && p.openTime && p.endTime)
    .filter(p => p.endTime * 1000 > now)
    .filter(p => !SKIP_RULES.has(String(p.gachaRuleType)) && !SKIP_POOL_NAME.test(p.gachaPoolName))
    .filter(p => p.endTime - p.openTime < MAX_POOL_DAYS * 86400)
    .map(p => ({
      type: 'character',
      name: p.gachaPoolName,
      startsAt: new Date(p.openTime * 1000).toISOString(),
      endsAt: new Date(p.endTime * 1000).toISOString(),
      featured: [],
      image: null,
    }))
    .sort((x, y) => Date.parse(x.startsAt) - Date.parse(y.startsAt))

  const news = (newsRes?.data?.rows ?? [])
    .filter(n => n?.title && n.publishTime)
    .map(n => ({
      title: n.title.trim(),
      url: n.link || '',
      image: n.bigImage || n.smallImage || null,
      publishedAt: new Date(n.publishTime).toISOString(),
      category: n.type || 'announcement',
    }))

  return {
    gameId: 'arknights', gameName: game.name, version: {},
    banners, events, news,
    syncedAt: new Date().toISOString(),
  }
}