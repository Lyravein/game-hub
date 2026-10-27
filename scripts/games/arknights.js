// Arknights EN (YoStar): events and gacha pools from ArknightsAssets/ArknightsGamedata (master),
// news from the official website API (www.arknights.global/api/resource/news/list).
// Global release dates of the next events only exist on the community wiki, so the next-version
// block is filled from there (best effort; the UI hides it when the wiki has no dated entry).
const BASE = 'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel'
const NEWS_API = 'https://www.arknights.global/api/resource/news/list?index=1&size=12&type=latest'
const WIKI_API = 'https://arknights.wiki.gg/api.php?action=parse&prop=wikitext&format=json&formatversion=2&page='
const SKIP_TYPES = new Set([
  'CHECKIN_ONLY', 'LOGIN_ONLY', 'CHECKIN_ACCESS', 'PRAY_ONLY', 'CHECKIN_VS',
  'CHECKIN_ALL_PLAYER', 'CHECKIN_VIDEO', 'SWITCH_ONLY', 'UNIQUE_ONLY', 'MISSION_ONLY',
])
// Weekly rotating pools and the permanent returning pool are not announced banners.
const SKIP_RULES = new Set(['DOUBLE', 'CLASSIC_DOUBLE', 'FESCLASSIC', 'CLASSIC_ATTAIN', 'RETURN'])
const SKIP_POOL_NAME = /rare operators|returning headhunting/i
const MAX_POOL_DAYS = 120

// Wiki cells look like "{{Onup events cell\n|name = X\n|globalstart = 2026/11/05 04:00:00\n|globalend = ...}}"
// and Global dates are UTC-7 (the wiki says so on the page).
export function parseWikiEvents(wikitext) {
  const iso = (s) => {
    const m = String(s || '').match(/(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/)
    if (!m) return null
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}-07:00`).toISOString()
  }
  const out = []
  for (const chunk of String(wikitext).split('{{Onup events cell').slice(1)) {
    const field = k => (chunk.match(new RegExp(`\\|\\s*${k}\\s*=\\s*([^\\n}]*)`)) || [])[1]?.trim() || ''
    const name = field('name')
    const startsAt = iso(field('globalstart'))
    if (!name || !startsAt) continue
    out.push({ name, startsAt, endsAt: iso(field('globalend')) })
  }
  return out
}

export async function buildFeed({ fetchJson, game }) {
  const [act, gacha, newsRes, wikiPage] = await Promise.all([
    fetchJson(`${BASE}/activity_table.json`),
    fetchJson(`${BASE}/gacha_table.json`),
    fetchJson(NEWS_API).catch(() => null),
    fetchJson(`${WIKI_API}Event`).catch(() => null),
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

  const nextRelease = parseWikiEvents(wikiPage?.parse?.wikitext)
    .filter(e => Date.parse(e.startsAt) > now)
    .sort((x, y) => Date.parse(x.startsAt) - Date.parse(y.startsAt))[0]
  const episode = news.map(n => n.title.match(/EPISODE\s+(\d+)/i)).find(Boolean)
  const version = nextRelease
    ? { current: episode ? `Ep ${episode[1]}` : '', next: { number: nextRelease.name, startsAt: nextRelease.startsAt } }
    : {}

  return {
    gameId: 'arknights', gameName: game.name, version,
    banners, events, news,
    syncedAt: new Date().toISOString(),
  }
}