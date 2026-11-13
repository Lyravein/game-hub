import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { validateFeed } from '../../shared/feed-schema.js'
import GAMES from '../../../games.config.js'

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data')
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000

export default defineEventHandler(() => {
  const games = []
  for (const g of GAMES) {
    const p = join(DATA_DIR, g.id, 'feed.json')
    if (!existsSync(p)) continue
    try {
      const feed = JSON.parse(readFileSync(p, 'utf8'))
      const v = validateFeed(feed)
      if (!v.ok) { console.warn(`[api] invalid feed ${g.id}:`, v.errors.join(';')); continue }

      // In-memory prune: omits ended items immediately without waiting for nightly cron
      const now = Date.now()
      if (Array.isArray(feed.banners)) {
        feed.banners = feed.banners.filter(b => Date.parse(b.endsAt) > now)
      }
      if (Array.isArray(feed.events)) {
        feed.events = feed.events.filter(e => Date.parse(e.endsAt) > now)
      }
      if (Array.isArray(feed.news)) {
        feed.news = feed.news.filter(n => {
          const publishedAt = Date.parse(n.publishedAt)
          return !Number.isNaN(publishedAt) && now - publishedAt <= FIVE_DAYS_MS
        })
      }
      if (Array.isArray(feed.redeemCodes)) {
        feed.redeemCodes = feed.redeemCodes.flatMap(code => {
          if (!Array.isArray(code?.windows) || code.windows.length === 0) return [code]
          const windows = code.windows.filter(window => {
            const expiresAt = Date.parse(window?.expiresAt)
            return Number.isNaN(expiresAt) || expiresAt > now
          })
          return windows.length > 0 ? [{ ...code, windows }] : []
        })
      }
      if (feed.version?.next?.startsAt && Date.parse(feed.version.next.startsAt) <= now) {
        if (feed.version.next.number && feed.version.next.number !== 'TBA') {
          feed.version.current = feed.version.next.number
        }
        feed.version.next = undefined
      }

      games.push(feed)
    } catch (e) { console.warn(`[api] unreadable feed ${g.id}:`, e.message) }
  }
  games.sort((a, b) => GAMES.findIndex(x => x.id === a.gameId) - GAMES.findIndex(x => x.id === b.gameId))
  return { syncedAt: games.map(g => g.syncedAt).sort().at(-1) ?? null, games }
})
