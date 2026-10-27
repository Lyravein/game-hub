import { test } from 'node:test'
import assert from 'node:assert/strict'
import GAMES from '../games.config.js'
import { validateFeed } from '../app/shared/feed-schema.js'

// nte and arknights fetch live sources, so they are covered by their own parser tests instead.
for (const id of ['arknights-endfield', 'wuthering-waves']) {
  test(`${id} adapter returns a valid empty feed without external access`, async () => {
    const game = GAMES.find(item => item.id === id)
    const { buildFeed } = await import(`../scripts/games/${id}.js`)
    const feed = await buildFeed({ game, fetchJson: async () => { throw new Error('unexpected network access') } })

    assert.equal(feed.gameId, id)
    assert.equal(feed.gameName, game.name)
    assert.deepEqual(feed.version, {})
    assert.deepEqual(feed.banners, [])
    assert.deepEqual(feed.events, [])
    assert.deepEqual(feed.news, [])
    assert.equal(validateFeed(feed).ok, true)
  })
}
