import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { validateFeed } from '../../shared/feed-schema.js'
import GAMES from '../../../games.config.js'

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data')

export default defineEventHandler(() => {
  const games = []
  for (const g of GAMES) {
    const p = join(DATA_DIR, g.id, 'feed.json')
    if (!existsSync(p)) continue
    try {
      const feed = JSON.parse(readFileSync(p, 'utf8'))
      const v = validateFeed(feed)
      if (!v.ok) { console.warn(`[api] invalid feed ${g.id}:`, v.errors.join('; ')); continue }
      games.push(feed)
    } catch (e) { console.warn(`[api] unreadable feed ${g.id}:`, e.message) }
  }
  games.sort((a, b) => GAMES.findIndex(x => x.id === a.gameId) - GAMES.findIndex(x => x.id === b.gameId))
  return { syncedAt: games.map(g => g.syncedAt).sort().at(-1) ?? null, games }
})
