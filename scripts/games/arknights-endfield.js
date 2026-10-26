const SITE = 'https://endfield.gryphline.com/en-us'
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }

// Site renders server-side; every value we need arrives inside the HTML payload.
function toIso (month, day, year, hour, minute) {
  const t = Date.UTC(year, MONTHS[month], Number(day), Number(hour), Number(minute))
  return new Date(t - 8 * 3600e3).toISOString() // server time is UTC+8
}

function findDate (text, re) {
  const all = [...text.matchAll(new RegExp(re.source, 'g'))]
  const m = all.at(-1)
  return m ? toIso(m[1], m[2], m[3], m[4], m[5]) : null
}

const DATE = /([A-Z][a-z]{2})\.? (\d{1,2}), (\d{4}) at (\d{2}):(\d{2})/

function decode (s) {
  try { return JSON.parse(`"${s}"`) } catch { return s }
}

function parseNews (html) {
  const text = html.replace(/\\"/g, '"')
  const re = /\{"cid":"([^"]+)","tab":"([^"]+)","sticky":(?:true|false),"title":"((?:[^"\\]|\\.)*)","author":"[^"]*","displayTime":(\d+),"cover":"([^"]*)"/g
  const out = []
  const seen = new Set()
  let m
  while ((m = re.exec(text)) !== null) {
    const [, cid, tab, title, ts, cover] = m
    if (seen.has(cid)) continue
    seen.add(cid)
    out.push({ cid, tab, title: decode(title), ts: Number(ts), cover })
  }
  return out.sort((a, b) => b.ts - a.ts)
}

// Article bodies are rendered into the page; strip tags to read the structured sections.
function articleText (html) {
  const start = html.indexOf('NoticeDetail_content')
  const body = start === -1 ? html : html.slice(start, start + 80000).split('<script')[0]
  const lines = body
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|div|li|h\d)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
  return lines
}

function section (lines, heading) {
  const i = lines.findIndex(l => l.startsWith(heading))
  if (i === -1) return []
  const out = []
  for (let j = i + 1; j < lines.length; j++) {
    if (/^[■▼]/.test(lines[j])) break
    out.push(lines[j])
  }
  return out
}

function parseWindow (text, versionStart) {
  const parts = text.split(/\s+[–-]\s+/)
  return {
    startsAt: findDate(parts[0], DATE) || versionStart,
    endsAt: parts.length >= 2 ? findDate(parts[1], DATE) : findDate(parts[0], DATE)
  }
}

function rewards (text) {
  const out = []
  for (const m of text.matchAll(/\[([^\]]+)\]×(\d+)/g)) out.push(`${m[1]} x${m[2]}`)
  return [...new Set(out)].slice(0, 3)
}

function parseBanners (lines, versionStart) {
  const block = section(lines, '■ New Headhunting Events')
  const out = []
  for (let i = 0; i < block.length; i++) {
    const head = block[i].match(/^\d+\.\s*(.+)$/)
    if (!head) continue
    const name = head[1].trim()
    const body = []
    for (let j = i + 1; j < block.length && !/^\d+\./.test(block[j]); j++) body.push(block[j])
    const joined = body.join(' ')
    const avail = body.find(l => /Availability:/.test(l)) || ''
    const window = parseWindow(avail.replace(/^·\s*Availability:\s*/, ''), versionStart)
    const featured = joined.match(/Rate-UP 6★ (operator|weapon) \[([^\]]+)\]/)
    out.push({
      type: featured && featured[1] === 'weapon' ? 'weapon' : 'character',
      name: name.replace(/\s+(Open|Issue)$/i, '').trim(),
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      featured: featured ? [featured[2]] : []
    })
  }
  return out
}

function parseEvents (lines, versionStart, fallbackEnd) {
  const block = section(lines, '■ New Events')
  const out = []
  for (let i = 0; i < block.length; i++) {
    const head = block[i].match(/^\d+\.\s*\[([^\]]+)\]\s*(.*)$/)
    if (!head) continue
    const body = []
    for (let j = i + 1; j < block.length && !/^\d+\./.test(block[j]); j++) body.push(block[j])
    const joined = body.join(' ')
    const timeLine = body.find(l => /Event Time:/.test(l))
    if (!timeLine) continue
    const window = parseWindow(timeLine.replace(/^·\s*Event Time:\s*/, ''), versionStart)
    out.push({
      name: head[1].trim(),
      startsAt: window.startsAt || versionStart,
      endsAt: window.endsAt || fallbackEnd,
      rewards: rewards(joined)
    })
  }
  return out
}

// The public version-briefing bundle ships per-item thumbnails; no login needed.
const BRIEF_SECTIONS = ['gameplay', 'characters', 'weapons']

async function briefingArt (fetchText) {
  const page = await fetchText('https://endfield.gryphline.com/version_briefing/latest?source_from=official')
  const js = page.match(/src="(https:\/\/[^"]+version-v[^"]+\.js)"/)
  if (!js) return {}
  const code = await fetchText(js[1])
  const base = code.match(/l\.p="(https:\/\/[^"]+\/)"/)
  if (!base) return {}

  // Asset paths sit in one shared map, names sit in per-section arrays.
  const assets = {}
  for (const m of code.matchAll(/"(gameplay|characters|weapons)\.(\d+)\.thumbnail":l\.p\+"(assets\/imgs\/[^"]+)"/g)) {
    assets[`${m[1]}.${m[2]}`] = base[1] + m[3]
  }

  const out = {}
  for (const section of BRIEF_SECTIONS) {
    const pos = code.indexOf(`"${section}":[`)
    if (pos === -1) continue
    const list = sliceArray(code, pos + section.length + 3)
    const byName = {}
    list.forEach((obj, i) => {
      const name = obj.match(/[{,]"name":\{"zh-cn":"[^"]*","en-us":"((?:[^"\\]|\\.)*)"/)
      const art = assets[`${section}.${i}`]
      if (name && art) byName[norm(name[1])] = art
    })
    out[section] = byName
  }
  return out
}

// Returns the top-level objects of a JSON array starting at `start` ("[" index).
function sliceArray (code, start) {
  const items = []
  let depth = 0
  let objStart = -1
  for (let i = start; i < code.length; i++) {
    const c = code[i]
    if (c === '[' || c === '{') {
      if (c === '{' && depth === 1) objStart = i
      depth++
    } else if (c === ']' || c === '}') {
      depth--
      if (c === '}' && depth === 1 && objStart !== -1) {
        items.push(code.slice(objStart, i + 1))
        objStart = -1
      }
      if (depth === 0) break
    }
  }
  return items
}

function norm (s) {
  return s.replace(/\\'/g, "'").replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase()
}

function matchArt (byName, name) {
  return (byName && byName[norm(name)]) || null
}

export async function buildFeed ({ game, fetchText }) {
  let news = []
  let banners = []
  let events = []
  let version = {}

  if (fetchText) {
    try {
      const items = parseNews(await fetchText(`${SITE}/news`))
      if (items.length) {
        news = items.slice(0, 12).map(it => ({
          title: it.title,
          url: `${SITE}/news/${it.cid}`,
          image: it.cover || null,
          publishedAt: new Date(it.ts * 1000).toISOString(),
          category: it.tab
        }))

        // Newest "Version Update Notes" carries version name, windows, banners and events.
        const notes = items.find(it => /Version Update Notes/i.test(it.title))
        if (notes) {
          const lines = articleText(await fetchText(`${SITE}/news/${notes.cid}`))
          const name = notes.title.match(/^\[([^\]]+)\]/)
          const open = lines.find(l => /^Asia Server:/.test(l))
          const versionStart = open ? findDate(open, DATE) : null

          const parsedBanners = parseBanners(lines, versionStart)
          const stale = b => !b.endsAt || !b.startsAt || Date.parse(b.endsAt) <= Date.parse(b.startsAt)
          const knownEnds = parsedBanners.filter(b => !stale(b)).map(b => b.endsAt).sort()
          const fallbackEnd = knownEnds.at(-1) || versionStart
          banners = parsedBanners.map(b => ({
            ...b,
            startsAt: b.startsAt || versionStart,
            endsAt: stale(b) ? fallbackEnd : b.endsAt
          }))
          events = parseEvents(lines, versionStart, fallbackEnd)

          try {
            const art = await briefingArt(fetchText)
            for (const e of events) e.image = matchArt(art.gameplay, e.name)
            for (const b of banners) {
              if (b.image) continue
              const pool = b.type === 'weapon' ? art.weapons : art.characters
              b.image = matchArt(pool, b.featured?.[0] || '')
            }
          } catch (err) {
            console.warn('[arknights-endfield] briefing art unavailable:', err.message)
          }

          // Banner art: reuse the notice cover of the matching headhunting article.
          for (const b of banners) {
            const tag = b.name.match(/^\[([^\]]+)\]/)
            const hit = tag && items.find(it => it.cover && it.title.includes(`[${tag[1]}]`))
            if (hit) b.image = hit.cover
          }

          if (name) version = { current: name[1], next: { number: 'TBA', startsAt: fallbackEnd } }
        }
      }
    } catch (e) {
      console.warn('[arknights-endfield] live fetch failed:', e.message)
      news = []; banners = []; events = []; version = {}
    }
  }

  return {
    gameId: game.id,
    gameName: game.name,
    version,
    banners,
    events,
    news,
    syncedAt: new Date().toISOString()
  }
}