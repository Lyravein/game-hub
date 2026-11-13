const SITE = 'https://endfield.gryphline.com/en-us'
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }

// Site renders server-side; every value we need arrives inside the HTML payload.
function toIso (month, day, year, hour, minute) {
  const t = Date.UTC(year, MONTHS[month], Number(day), Number(hour), Number(minute))
  const date = new Date(t - 8 * 3600e3) // server time is UTC+8
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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
  const source = String(html || '')
  const start = source.indexOf('NoticeDetail_content')
  const body = start === -1 ? source : source.slice(start, start + 80000).split('<script')[0]
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

const REDEEM_CODE_LABEL = /(?:redemption|redeem(?:able)?|coupon|promo(?:tional)?)\s+codes?\b\s*(?:(?:is|are)\s*)?(?:[:：=-]\s*)?/gi
const REDEEM_CODE_TOKEN = /^[A-Z0-9][A-Z0-9_-]{3,}(?![A-Z0-9_-])/
const REDEEM_CODE_CANDIDATE = /\b[A-Z0-9][A-Z0-9_-]{5,}\b/g
const REDEEM_NOTICE = /Redemption Code|Redeem Code|Coupon Code|Milestone/i
const REDEEM_REGION = /\b(?:Asia|Americas?|Europe)\b/i

function siteIso (year, month, day, hour = 0, minute = 0, second = 0) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) - 8 * 3600e3)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function redeemDates (text) {
  const found = []
  const numeric = /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?/gi
  for (const m of text.matchAll(numeric)) {
    let iso = null
    if (m[7]) {
      const parsed = Date.parse(m[0].replace(' ', 'T'))
      if (!Number.isNaN(parsed)) iso = new Date(parsed).toISOString()
    } else {
      iso = siteIso(m[1], m[2], m[3], m[4] || 0, m[5] || 0, m[6] || 0)
    }
    if (iso) found.push({ index: m.index, iso })
  }

  for (const m of text.matchAll(new RegExp(DATE.source, 'g'))) {
    const iso = toIso(m[1], m[2], m[3], m[4], m[5])
    if (iso) found.push({ index: m.index, iso })
  }

  const seen = new Set()
  return found
    .sort((a, b) => a.index - b.index)
    .map(item => item.iso)
    .filter(iso => !seen.has(iso) && seen.add(iso))
}

function regionWindow (lines, matches) {
  const starts = []
  const expires = []
  lines.forEach((line, index) => {
    if (!matches(line)) return
    const segment = [line]
    for (let i = index + 1; i < lines.length && i < index + 4; i++) {
      if (REDEEM_REGION.test(lines[i])) break
      segment.push(lines[i])
    }
    const dates = redeemDates(segment.join('\n'))
    if (dates.length) starts.push(dates[0])
    if (dates.length > 1) expires.push(dates[1])
  })
  return {
    startsAt: starts.length ? starts.sort()[0] : undefined,
    expiresAt: expires.length ? expires.sort().at(-1) : undefined
  }
}

function normalizeReward (value) {
  return String(value)
    .replace(/^[-•*]\s*/, '')
    .replace(/&times;/gi, 'x')
    .replace(/[×✕]/g, 'x')
    .replace(/\s*x\s*(\d+)/gi, ' x$1')
    .trim()
}

function redeemRewards (lines) {
  const out = []
  const add = value => {
    const reward = normalizeReward(value)
    if (reward && !/^(?:code|server|region)\b/i.test(reward)) out.push(reward)
  }

  for (const line of lines) {
    const labeled = line.match(/(?:^|\s)rewards?\s*:\s*(.+)$/i)
    if (!labeled) continue
    for (const value of labeled[1].split(/[,;•]/)) add(value)
  }

  const heading = lines.findIndex(line => /redeem(?:able)?\s+rewards|milestone\s+rewards/i.test(line))
  if (heading !== -1) {
    for (const line of lines.slice(heading + 1)) {
      if (/^[■▼]/.test(line)) break
      const value = line.replace(/^[-•*]\s*/, '').trim()
      if (!value) continue
      if (/[x×]\s*\d+/i.test(value)) {
        for (const part of value.split(/[,;]|\s+and\s+(?=[A-Za-z])/i)) add(part)
      } else if (/^[-•*]/.test(line)) {
        add(value)
      }
    }
  }

  return [...new Set(out)].slice(0, 10)
}

function extractRedeemCode (lines) {
  const text = lines.join('\n')
  for (const label of text.matchAll(REDEEM_CODE_LABEL)) {
    const token = text.slice(label.index + label[0].length).match(REDEEM_CODE_TOKEN)
    if (token) return token[0]
  }

  for (const token of text.matchAll(REDEEM_CODE_CANDIDATE)) {
    if (/\d/.test(token[0]) || token[0].length >= 12) return token[0]
  }
  return null
}

function parseRedeemNotice (lines, sourceUrl, verifiedAt) {
  const code = extractRedeemCode(lines)
  if (!code) return null

  const windows = []
  const asia = regionWindow(lines, line => /\bAsia\b/i.test(line))
  const americasEurope = regionWindow(lines, line => /\b(?:Americas?|Europe)\b/i.test(line))
  if (asia.startsAt || asia.expiresAt) {
    windows.push({ region: 'Asia', ...(asia.startsAt ? { startsAt: asia.startsAt } : {}), ...(asia.expiresAt ? { expiresAt: asia.expiresAt } : {}) })
  }
  if (americasEurope.startsAt || americasEurope.expiresAt) {
    windows.push({ region: 'Americas-Europe', ...(americasEurope.startsAt ? { startsAt: americasEurope.startsAt } : {}), ...(americasEurope.expiresAt ? { expiresAt: americasEurope.expiresAt } : {}) })
  }

  return {
    code,
    rewards: redeemRewards(lines),
    source: { name: 'Arknights: Endfield Official News', url: sourceUrl },
    ...(verifiedAt ? { verifiedAt } : {}),
    ...(windows.length ? { windows } : {})
  }
}

export async function parseRedeemCodes (items, fetchText) {
  if (!Array.isArray(items) || typeof fetchText !== 'function') {
    return { ok: false, codes: [], error: 'invalid redemption input' }
  }
  const candidates = items.slice(0, 12)
  const ordered = [
    ...candidates.filter(item => REDEEM_NOTICE.test(item?.title || '')),
    ...candidates.filter(item => !REDEEM_NOTICE.test(item?.title || ''))
  ]

  const codes = []
  let error = null
  for (const item of ordered) {
    if (!item?.cid) continue
    try {
      const html = await fetchText(`${SITE}/news/${item.cid}`)
      const lines = articleText(html)
      if (!REDEEM_NOTICE.test(`${item.title || ''}\n${lines.join('\n')}`)) continue
      const timestamp = new Date(Number(item.ts) * 1000)
      const verifiedAt = Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : undefined
      const record = parseRedeemNotice(lines, `${SITE}/news/${item.cid}`, verifiedAt)
      if (record) {
        codes.push(record)
        break
      }
      error ||= new Error(`redemption code not found in notice ${item.cid}`)
    } catch (e) {
      error ||= e
    }
  }

  if (error) {
    const message = error.message || String(error)
    console.warn('[arknights-endfield] redemption parse failed:', message)
    return { ok: false, codes, error: message }
  }
  return { ok: true, codes }
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
  let items = []
  let sourceFetched = false

  if (fetchText) {
    try {
      items = parseNews(await fetchText(`${SITE}/news`))
      sourceFetched = true
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
      if (!sourceFetched) items = []
    }
  }

  let redeemResult = { ok: false, codes: [], error: 'news list unavailable' }
  if (sourceFetched) {
    try {
      redeemResult = await parseRedeemCodes(items, fetchText)
    } catch (e) {
      redeemResult = { ok: false, codes: [], error: e.message || String(e) }
      console.warn('[arknights-endfield] redemption parse failed:', redeemResult.error)
    }
  }

  const syncedAt = new Date().toISOString()
  return {
    gameId: game.id,
    gameName: game.name,
    version,
    banners,
    events,
    news,
    redeemCodes: redeemResult.codes,
    redeemSync: {
      mode: 'automatic',
      status: redeemResult.ok ? 'ok' : 'stale',
      lastSuccessAt: redeemResult.ok ? syncedAt : null
    },
    syncedAt
  }
}