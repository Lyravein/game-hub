import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pruneExpired } from '../scripts/sync.js'

test('pruneExpired discards news older than 5 days and keeps fresh news', () => {
  const now = Date.parse('2026-11-13T12:00:00.000Z')
  const feed = {
    gameId: 'test',
    syncedAt: '2026-11-13T12:00:00.000Z',
    news: [
      {
        title: 'Recent News 1 day ago',
        publishedAt: '2026-11-12T12:00:00.000Z',
        url: 'https://example.com/1'
      },
      {
        title: 'Boundary News 4.9 days ago',
        publishedAt: '2026-11-08T15:00:00.000Z',
        url: 'https://example.com/2'
      },
      {
        title: 'Old News 6 days ago',
        publishedAt: '2026-11-07T11:00:00.000Z',
        url: 'https://example.com/3'
      },
      {
        title: 'Very Old News 20 days ago',
        publishedAt: '2026-10-24T12:00:00.000Z',
        url: 'https://example.com/4'
      }
    ]
  }

  const pruned = pruneExpired(feed, now)
  assert.equal(pruned.news.length, 2)
  assert.equal(pruned.news[0].title, 'Recent News 1 day ago')
  assert.equal(pruned.news[1].title, 'Boundary News 4.9 days ago')
})

test('pruneExpired discards ended events and keeps ongoing events', () => {
  const now = Date.parse('2026-11-13T12:00:00.000Z')
  const feed = {
    gameId: 'test',
    syncedAt: '2026-11-13T12:00:00.000Z',
    events: [
      {
        name: 'Ongoing Event',
        endsAt: '2026-11-20T12:00:00.000Z'
      },
      {
        name: 'Past Event',
        endsAt: '2026-11-10T12:00:00.000Z'
      },
      {
        name: 'Permanent Event',
        endsAt: null
      }
    ]
  }

  const pruned = pruneExpired(feed, now)
  assert.equal(pruned.events.length, 2)
  assert.equal(pruned.events[0].name, 'Ongoing Event')
  assert.equal(pruned.events[1].name, 'Permanent Event')
})
