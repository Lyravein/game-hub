// Neverness to Everness (Perfect World / Hotta Studio).
// News comes from the official site's paginated article list (index.html, index1.html, ...).
// The official site publishes no machine-readable banner schedule, so banner names, dates and art
// come from ntebuild's banner tracker, read out of its Next.js flight payload (best effort).
const NEWS_BASE = 'https://nte.perfectworld.com/en/article/news'
const NEWS_PAGES = ['index.html', 'index1.html', 'index2.html']
const BANNER_PAGE = 'https://www.ntebuild.com/banners'
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) game-hub-sync/0.1' }

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }
const decode = (s) => String(s).replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, k) => ENTITIES[k]).trim()

export function parseNteNews(html) {
  const out = []
  const re = /<a[^>]+href="(\/en\/article\/news\/[^"]+)"[^>]*>[\s\S]*?<h2 class="title">([\s\S]*?)<\/h2>[\s\S]*?<p class="date">([\s\S]*?)<\/p>\s*<p class="type">([\s\S]*?)<\/p>/g
  for (const m of String(html).matchAll(re)) {
    const date = decode(m[3])
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    out.push({
      title: decode(m[2]),
      url: `https://nte.perfectworld.com${m[1]}`,
      publishedAt: new Date(`${date}T00:00:00.000Z`).toISOString(),
      category: decode(m[4]).toLowerCase() || 'news',
    })
  }
  return out
}

// The page streams its banner data as escaped JSON strings: self.__next_f.push([1,"..."]).
function flightText(html) {
  let out = ''
  for (const m of String(html).matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try { out += JSON.parse(m[1]) } catch { /* skip unparsable chunk */ }
  }
  return out
}

// A banner record starts with {"version": ... and is a plain flat object, so brace-match it.
function bannerRecords(text) {
  const out = []
  for (let i = text.indexOf('{"version":"'); i !== -1; i = text.indexOf('{"version":"', i + 1)) {
    let depth = 0
    let inStr = false
    let esc = false
    for (let k = i; k < text.length; k++) {
      const c = text[k]
      if (inStr) {
        if (esc) esc = false
        else if (c === '\\') esc = true
        else if (c === '"') inStr = false
        continue
      }
      if (c === '"') inStr = true
      else if (c === '{') depth++
      else if (c === '}' && --depth === 0) {
        try { out.push(JSON.parse(text.slice(i, k + 1))) } catch { /* skip broken record */ }
        break
      }
    }
  }
  return out
}

export function parseNteBanners(html) {
  const seen = new Set()
  return bannerRecords(flightText(html))
    .filter(b => b?.name && b.startDate && b.plannedEndDate && !seen.has(b.name) && seen.add(b.name))
    .map(b => ({
      type: 'character',
      name: b.name,
      startsAt: new Date(b.startDate).toISOString(),
      endsAt: new Date(b.plannedEndDate).toISOString(),
      featured: [],
      image: b.gacha ? `https://www.ntebuild.com${b.gacha}` : null,
    }))
    .sort((x, y) => Date.parse(x.startsAt) - Date.parse(y.startsAt))
}

async function fetchText(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

export async function buildFeed({ game }) {
  const now = Date.now()
  const [pages, bannerPage] = await Promise.all([
    Promise.all(NEWS_PAGES.map(p => fetchText(`${NEWS_BASE}/${p}`).catch(() => ''))),
    fetchText(BANNER_PAGE).catch(() => ''),
  ])

  const seen = new Set()
  const news = pages
    .flatMap(html => parseNteNews(html))
    .filter(n => !seen.has(n.url) && seen.add(n.url))
    .sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt))
    .slice(0, 12)

  const banners = parseNteBanners(bannerPage).filter(b => Date.parse(b.endsAt) > now)

  return {
    gameId: game.id, gameName: game.name, version: {},
    banners, events: [], news,
    syncedAt: new Date().toISOString(),
  }
}