import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateFeed } from '../app/shared/feed-schema.js'
import GAMES from '../games.config.js'
import { extractCardFromImage } from './lib/vision-parser.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = join(ROOT, '.env')
if (existsSync(ENV_FILE)) {
  try { process.loadEnvFile(ENV_FILE) } catch {}
}
const DATA_DIR = join(ROOT, 'data')
const VISION_CACHE_PATH = join(DATA_DIR, '.cache', 'vision-cache.json')
const FETCH_TIMEOUT_MS = 20000
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000

const normalizeRedeemCode = code => typeof code === 'string' ? code.trim().toUpperCase() : ''
const normalizeRedeemRegion = region => typeof region === 'string' ? region.trim().toLowerCase() : ''

export function mergeManual(feed, manual) {
  if (!manual || typeof manual !== 'object') return feed
  const out = structuredClone(feed)
  for (const key of ['version', 'events', 'news']) {
    if (manual[key] !== undefined) {
      if (Array.isArray(manual[key]) && manual[key].length > 0) {
        out[key] = structuredClone(manual[key])
      } else if (!Array.isArray(manual[key]) && typeof manual[key] === 'object' && Object.keys(manual[key]).length > 0) {
        out[key] = structuredClone(manual[key])
      }
    }
  }
  if (Array.isArray(manual.banners) && manual.banners.length > 0) {
    if (!out.banners || out.banners.length === 0) {
      out.banners = structuredClone(manual.banners)
    } else {
      const byName = new Map(out.banners.map((b, idx) => [(b.name || '').toLowerCase(), idx]))
      for (const mb of manual.banners) {
        const key = (mb.name || '').toLowerCase()
        if (byName.has(key)) {
          const idx = byName.get(key)
          out.banners[idx] = { ...out.banners[idx], ...structuredClone(mb) }
        } else {
          out.banners.push(structuredClone(mb))
        }
      }
    }
  }
  if (Array.isArray(manual.redeemCodes)) {
    out.redeemCodes = Array.isArray(out.redeemCodes) ? out.redeemCodes : []
    const byCode = new Map()
    out.redeemCodes.forEach((code, index) => byCode.set(normalizeRedeemCode(code?.code), index))

    for (const manualCode of manual.redeemCodes) {
      const key = normalizeRedeemCode(manualCode?.code)
      if (!byCode.has(key)) {
        out.redeemCodes.push(structuredClone(manualCode))
        byCode.set(key, out.redeemCodes.length - 1)
        continue
      }

      const index = byCode.get(key)
      const automaticCode = out.redeemCodes[index]
      const mergedCode = { ...automaticCode, ...structuredClone(manualCode) }
      if (Array.isArray(manualCode?.windows) && manualCode.windows.length > 0) {
        const byRegion = new Map()
        if (Array.isArray(automaticCode.windows)) {
          for (const window of automaticCode.windows) {
            byRegion.set(normalizeRedeemRegion(window?.region), window)
          }
        }
        for (const window of manualCode.windows) {
          byRegion.set(normalizeRedeemRegion(window?.region), window)
        }
        mergedCode.windows = [...byRegion.values()]
      } else if (Array.isArray(automaticCode.windows)) {
        mergedCode.windows = automaticCode.windows
      }
      out.redeemCodes[index] = mergedCode
    }
  }
  return out
}

export function pruneExpired(feed, now = Date.now()) {
  if (!feed || typeof feed !== 'object') return feed
  const out = structuredClone(feed)

  if (Array.isArray(out.banners)) {
    out.banners = out.banners.filter(b => {
      const e = Date.parse(b.endsAt)
      return Number.isNaN(e) || e > now
    })
  }

  if (Array.isArray(out.events)) {
    out.events = out.events.filter(e => !e.endsAt || Date.parse(e.endsAt) > now)
  }

  if (Array.isArray(out.redeemCodes)) {
    out.redeemCodes = out.redeemCodes.flatMap(code => {
      if (!Array.isArray(code?.windows) || code.windows.length === 0) return [code]
      const windows = code.windows.filter(window => {
        const expiresAt = Date.parse(window?.expiresAt)
        return Number.isNaN(expiresAt) || expiresAt > now
      })
      return windows.length > 0 ? [{ ...code, windows }] : []
    })
  }

  if (out.version?.next?.startsAt) {
    const nextStart = Date.parse(out.version.next.startsAt)
    if (!Number.isNaN(nextStart) && nextStart <= now) {
      if (out.version.next.number && out.version.next.number !== 'TBA') {
        out.version.current = out.version.next.number
      }
      out.version.next = undefined
    }
  }

  if (Array.isArray(out.news)) {
    out.news = out.news
      .filter(n => {
        const publishedAt = Date.parse(n.publishedAt)
        return !Number.isNaN(publishedAt) && now - publishedAt <= FIVE_DAYS_MS
      })
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .slice(0, 20)
  }

  return out
}

export async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'user-agent': 'game-hub-sync/0.1' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

export async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'user-agent': 'game-hub-sync/0.1' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

function loadManual(id) {
  const p = join(DATA_DIR, 'manual', `${id}.json`)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
}

async function syncOne(game) {
  const mod = await import(`./games/${game.id}.js`)
  let feed = await mod.buildFeed({ fetchJson, fetchText, game })
  feed = mergeManual(feed, loadManual(game.id))

  // Vision AI enrichment: extract banners/events from news images if configured
  if (process.env.VISION_API_BASE && process.env.VISION_API_KEY && process.env.VISION_MODEL && Array.isArray(feed.news)) {
    for (const item of feed.news.slice(0, 3)) {
      if (item.image && typeof item.image === 'string' && item.image.startsWith('http')) {
        try {
          const res = await extractCardFromImage({
            imageUrl: item.image,
            gameId: game.id,
            cachePath: VISION_CACHE_PATH
          })
          if (res.ok && res.data) {
            const isValidTs = ts => typeof ts === 'string' && !Number.isNaN(Date.parse(ts))
            if (Array.isArray(res.data.banners)) {
              for (const b of res.data.banners) {
                if (b && typeof b.name === 'string' && isValidTs(b.startsAt) && isValidTs(b.endsAt)) {
                  if (!feed.banners.some(existing => existing.name === b.name)) {
                    feed.banners.push({ ...b, source: 'vision-extracted', image: item.image })
                  }
                }
              }
            }
            if (Array.isArray(res.data.events)) {
              for (const ev of res.data.events) {
                if (ev && typeof ev.name === 'string' && isValidTs(ev.startsAt) && isValidTs(ev.endsAt)) {
                  if (!feed.events.some(existing => existing.name === ev.name)) {
                    feed.events.push({ ...ev, source: 'vision-extracted', image: item.image })
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[sync] vision parse skipped for ${game.id}: ${e.message}`)
        }
      }
    }
  }

  if (feed.redeemSync === undefined && Array.isArray(feed.redeemCodes) && feed.redeemCodes.length > 0) {
    feed.redeemSync = {
      mode: game.id === 'arknights-endfield' ? 'automatic' : 'manual-only',
      status: 'ok',
      lastSuccessAt: feed.syncedAt
    }
  }
  feed = pruneExpired(feed)
  const v = validateFeed(feed)
  if (!v.ok) throw new Error('invalid feed: ' + v.errors.join('; '))
  const dest = join(DATA_DIR, game.id, 'feed.json')
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, JSON.stringify(feed, null, 2) + '\n')
  return feed
}

const only = process.argv[2]
for (const game of GAMES.filter(g => !only || g.id === only)) {
  try {
    const f = await syncOne(game)
    console.log(`[sync] ${game.id}: ok (${f.events.length} events, ${f.news.length} news, ${f.banners.length} banners)`)
  } catch (e) {
    console.error(`[sync] ${game.id}: FAILED ${e.message}`)
  }
}
