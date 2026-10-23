import { test } from 'node:test'
import assert from 'node:assert/strict'

test('feed API returns the active game roster in configured order', async () => {
  globalThis.defineEventHandler = handler => handler
  const { default: getFeed } = await import('../app/server/api/feed.get.js')
  const result = getFeed()

  assert.deepEqual(result.games.map(game => game.gameId), [
    'zzz', 'arknights-endfield', 'arknights', 'wuthering-waves', 'nte',
  ])
  assert.equal(result.games.some(game => ['genshin', 'hsr'].includes(game.gameId)), false)
})
