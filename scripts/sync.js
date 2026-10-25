import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateFeed } from '../app/shared/feed-schema.js'
import GAMES from '../games.config.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'data')
const FETCH_TIMEOUT_MS = 20000

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
      const names = new Set(out.banners.map(b => (b.name || '').toLowerCase()))
      for (const mb of manual.banners) {
        if (!names.has((mb.name || '').toLowerCase())) {
          out.banners.push(structuredClone(mb))
        }
      }
    }
  }
  return out
}

export async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'user-agent': 'game-hub-sync/0.1' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

function loadManual(id) {
  const p = join(DATA_DIR, 'manual', `${id}.json`)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
}

async function syncOne(game) {
  const mod = await import(`./games/${game.id}.js`)
  let feed = await mod.buildFeed({ fetchJson, game })
  feed = mergeManual(feed, loadManual(game.id))
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
