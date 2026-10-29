import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pruneExpired } from '../scripts/sync.js'

test('pruneExpired discards ended banners and events while keeping active ones', () => {
  const fakeNow = 1700000000000
  const feed = {
    gameId: 'test',
    version: {
      current: '1.0',
      next: { number: '1.1', startsAt: new Date(fakeNow - 1000).toISOString() }
    },
    banners: [
      { name: 'Ended Banner', endsAt: new Date(fakeNow - 5000).toISOString() },
      { name: 'Active Banner', endsAt: new Date(fakeNow + 5000).toISOString() }
    ],
    events: [
      { name: 'Old Event', endsAt: new Date(fakeNow - 10000).toISOString() },
      { name: 'Active Event', endsAt: new Date(fakeNow + 10000).toISOString() }
    ],
    news: [
      { title: 'N1', publishedAt: new Date(fakeNow).toISOString() }
    ]
  }

  const pruned = pruneExpired(feed, fakeNow)

  assert.equal(pruned.banners.length, 1)
  assert.equal(pruned.banners[0].name, 'Active Banner')
  assert.equal(pruned.events.length, 1)
  assert.equal(pruned.events[0].name, 'Active Event')
  assert.equal(pruned.version.current, '1.1')
  assert.equal(pruned.version.next, undefined)
})
