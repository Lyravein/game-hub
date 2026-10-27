// Arknights CN (Hypergryph): events and gacha pools from Kengxxiao/ArknightsGameData (zh_CN, master),
// news from the list embedded in the server-rendered page at ak.hypergryph.com/news.
// The gamedata dump carries no banner art and no rate-up list, so those stay empty and
// data/manual/arknights.json can fill them in.
const BASE = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel'
const NEWS_PAGE = 'https://ak.hypergryph.com/news'
const NEWS_TABS = { 0: 'announcement', 1: 'activity', 2: 'news' }
const SKIP_TYPES = new Set([
  'CHECKIN_ONLY', 'LOGIN_ONLY', 'CHECKIN_ACCESS', 'PRAY_ONLY', 'CHECKIN_VS',
  'CHECKIN_ALL_PLAYER', 'CHECKIN_VIDEO', 'SWITCH_ONLY', 'UNIQUE_ONLY', 'MISSION_ONLY',
])
// Weekly rotating pools and the permanent returning pool are not announced banners.
const SKIP_RULES = new Set(['DOUBLE', 'CLASSIC_DOUBLE', 'FESCLASSIC', 'CLASSIC_ATTAIN', 'BACKFLOW'])
const SKIP_POOL_NAME = /适合多种场合|归航寻访/
const MAX_POOL_DAYS = 120

// The news list ships inside the Next.js flight payload as an escaped JS string literal.
function embeddedNews(html) {
  const plain = String(html).replace(/\\(["\\])/g, '$1')
  const at = plain.indexOf('"initialData":')
  if (at < 0) return []
  const start = plain.indexOf('{', at)
  let depth = 0
  let inStr = false
  let esc = false
  let end = -1
  for (let i = start; i < plain.length; i++) {
    const c = plain[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) { end = i + 1; break }
  }
  if (end < 0) return []
  try {
    return JSON.parse(plain.slice(start, end)).LATEST?.list ?? []
  } catch {
    return []
  }
}

export async function buildFeed({ fetchJson, fetchText, game }) {
  const [act, gacha, page] = await Promise.all([
    fetchJson(`${BASE}/activity_table.json`),
    fetchJson(`${BASE}/gacha_table.json`),
    fetchText(NEWS_PAGE).catch(() => ''),
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

  const news = embeddedNews(page)
    .filter(n => n?.title && n.displayTime)
    .map(n => ({
      title: n.title.trim(),
      url: `https://ak.hypergryph.com/news/${n.cid}`,
      image: n.cover || n.extraCover || null,
      publishedAt: new Date(n.displayTime * 1000).toISOString(),
      category: NEWS_TABS[n.tab] || 'announcement',
    }))

  return {
    gameId: 'arknights', gameName: game.name, version: {},
    banners, events, news,
    syncedAt: new Date().toISOString(),
  }
}