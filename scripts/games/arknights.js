// Arknights EN (YoStar): events and gacha pools from ArknightsAssets/ArknightsGamedata (master),
// news from the official website API (www.arknights.global/api/resource/news/list).
// Global release dates of upcoming events and banners only exist on the community wiki, so those
// come from there (best effort; the UI hides a block the wiki has no dated entry for).
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
// Standard and Kernel pools rotate every two weeks and carry no new Operators.
const SKIP_WIKI_BANNER_TYPES = new Set(['standard', 'kernel', 'kernel locating', 'kernel linkup'])
const MAX_FEATURED = 8

// Wiki dates look like "2026/11/05 04:00:00" and Global times are UTC-7 (the wiki says so).
function wikiDate(value) {
  const m = String(value || '').match(/(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}-07:00`).toISOString()
}

function wikiCells(wikitext, template) {
  return String(wikitext).split(`{{${template}`).slice(1).map(chunk => {
    const field = k => (chunk.match(new RegExp(`\\|\\s*${k}\\s*=\\s*([^\\n}]*)`)) || [])[1]?.trim() || ''
    return { field, name: field('name'), start: wikiDate(field('globalstart')), end: wikiDate(field('globalend')) }
  })
}

export function parseWikiEvents(wikitext) {
  return wikiCells(wikitext, 'Onup events cell')
    .filter(c => c.name && c.start)
    .map(c => ({ name: c.name, startsAt: c.start, endsAt: c.end }))
}

export function parseWikiBanners(wikitext) {
  const fallbackName = { orient: 'Orienteering', jo: 'Joint Operation' }
  return wikiCells(wikitext, 'Banners cell')
    .map(({ field, name, start, end }) => {
      const type = field('type')
      if (SKIP_WIKI_BANNER_TYPES.has(type)) return null
      const no = field('no')
      const label = name || (no ? `${fallbackName[type] || type} #${no}` : '')
      if (!label || !start || !end) return null
      const operators = field('operators').split(',').map(s => s.trim()).filter(Boolean)
      return { name: label, startsAt: start, endsAt: end, featured: operators.slice(0, MAX_FEATURED) }
    })
    .filter(Boolean)
}

export async function buildFeed({ fetchJson, game }) {
  const [act, gacha, newsRes, wikiEvents, wikiBanners] = await Promise.all([
    fetchJson(`${BASE}/activity_table.json`),
    fetchJson(`${BASE}/gacha_table.json`),
    fetchJson(NEWS_API).catch(() => null),
    fetchJson(`${WIKI_API}Event`).catch(() => null),
    fetchJson(`${WIKI_API}${encodeURIComponent('Headhunting/Banners/2026')}`).catch(() => null),
  ])
  const now = Date.now()

  const events = Object.values(act.basicInfo ?? {})
    .filter(a => a?.name && a.startTime && a.endTime && !SKIP_TYPES.has(a.type) && !a.isReplicate)
    .map(a => ({ name: a.name, startsAt: new Date(a.startTime * 1000).toISOString(), endsAt: new Date(a.endTime * 1000).toISOString(), rewards: [], url: '' }))
    .filter(e => Date.parse(e.endsAt) > now)
    .sort((x, y) => Date.parse(x.endsAt) - Date.parse(y.endsAt))
    .slice(0, 10)

  // The wiki knows the rate-up Operators and the Global dates; the game dump only knows pools that
  // are already live, so it fills in whatever the wiki has not listed yet.
  const dated = parseWikiBanners(wikiBanners?.parse?.wikitext)
    .filter(b => Date.parse(b.endsAt) > now)
  const seen = new Set(dated.map(b => b.name.toLowerCase()))
  const live = (gacha.gachaPoolClient ?? [])
    .filter(p => p?.gachaPoolName && p.openTime && p.endTime)
    .filter(p => p.endTime * 1000 > now && p.endTime - p.openTime < MAX_POOL_DAYS * 86400)
    .filter(p => !SKIP_RULES.has(String(p.gachaRuleType)) && !SKIP_POOL_NAME.test(p.gachaPoolName))
    .filter(p => !seen.has(p.gachaPoolName.toLowerCase()))
    .map(p => ({
      name: p.gachaPoolName,
      startsAt: new Date(p.openTime * 1000).toISOString(),
      endsAt: new Date(p.endTime * 1000).toISOString(),
      featured: [],
    }))

  const banners = [...dated, ...live]
    .map(b => ({ type: 'character', ...b, image: null }))
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

  const nextRelease = parseWikiEvents(wikiEvents?.parse?.wikitext)
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