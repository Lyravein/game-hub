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
    assert.ok(Array.isArray(feed.redeemCodes))
    assert.equal(validateFeed(feed).ok, true)
  })
}

test('all configured adapters return a redeemCodes array', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, text: async () => '' })
  try {
    for (const game of GAMES) {
      const { buildFeed } = await import(`../scripts/games/${game.id}.js`)
      let feed
      if (game.id === 'zzz') {
        feed = await buildFeed({ game, fetchJson: async () => ({ retcode: 0, data: { list: [] } }) })
      } else if (game.id === 'arknights-endfield') {
        feed = await buildFeed({ game, fetchText: async () => '' })
      } else if (game.id === 'arknights') {
        feed = await buildFeed({
          game,
          fetchJson: async url => {
            if (url.includes('activity_table')) return { basicInfo: {} }
            if (url.includes('gacha_table')) return { gachaPoolClient: [] }
            if (url.includes('/api/resource/news/list')) return { data: { rows: [] } }
            return { parse: { wikitext: '' } }
          },
        })
      } else if (game.id === 'wuthering-waves') {
        feed = await buildFeed({ game, fetchJson: async () => [] })
      } else {
        feed = await buildFeed({ game })
      }
      assert.ok(Array.isArray(feed.redeemCodes), `${game.id} redeemCodes`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('endfield adapter parses an official redemption notice', async () => {
  const game = GAMES.find(item => item.id === 'arknights-endfield')
  const { buildFeed } = await import('../scripts/games/arknights-endfield.js')
  const list = '{"cid":"redeem-1","tab":"announcement","sticky":false,"title":"Milestone Rewards","author":"Official","displayTime":1794000000,"cover":""}'
  const article = `
    <div class="NoticeDetail_content">
      <p>Milestone Rewards</p>
      <p>Chromite ×500</p>
      <p>EXP ×200</p>
      <p>Redemption Code: ENDFIELDSTEAM</p>
      <p>Asia Server: Nov 11, 2026 at 10:00 - Nov 18, 2026 at 23:00</p>
      <p>Americas, Europe Server: Nov 11, 2026 at 10:00 - Nov 18, 2026 at 23:00</p>
    </div>`
  const feed = await buildFeed({
    game,
    fetchText: async url => url.endsWith('/news') ? list : article,
  })

  assert.equal(feed.redeemCodes.length, 1)
  assert.deepEqual(feed.redeemCodes[0], {
    code: 'ENDFIELDSTEAM',
    rewards: ['Chromite x500', 'EXP x200'],
    source: { name: 'Arknights: Endfield Official News', url: 'https://endfield.gryphline.com/en-us/news/redeem-1' },
    verifiedAt: new Date(1794000000 * 1000).toISOString(),
    windows: [
      { region: 'Asia', startsAt: '2026-11-11T02:00:00.000Z', expiresAt: '2026-11-18T15:00:00.000Z' },
      { region: 'Americas-Europe', startsAt: '2026-11-11T02:00:00.000Z', expiresAt: '2026-11-18T15:00:00.000Z' },
    ],
  })
  assert.equal(validateFeed(feed).ok, true)
})

test('endfield adapter returns no redeem codes when notice parsing fails', async () => {
  const game = GAMES.find(item => item.id === 'arknights-endfield')
  const { buildFeed } = await import('../scripts/games/arknights-endfield.js')
  const list = '{"cid":"redeem-1","tab":"announcement","sticky":false,"title":"Milestone Rewards","author":"Official","displayTime":1794000000,"cover":""}'
  const feed = await buildFeed({
    game,
    fetchText: async url => {
      if (url.endsWith('/news')) return list
      throw new Error('article unavailable')
    },
  })

  assert.deepEqual(feed.redeemCodes, [])
  assert.equal(validateFeed(feed).ok, true)
})
