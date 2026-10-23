import { test } from 'node:test'
import assert from 'node:assert/strict'
import GAMES from '../games.config.js'

test('game roster contains the requested titles in order with unique ids', () => {
  assert.deepEqual(GAMES, [
    { id: 'zzz', name: 'Zenless Zone Zero' },
    { id: 'arknights-endfield', name: 'Arknights: Endfield' },
    { id: 'arknights', name: 'Arknights' },
    { id: 'wuthering-waves', name: 'Wuthering Waves' },
    { id: 'nte', name: 'Neverness to Everness (NTE)' },
  ])
  assert.equal(new Set(GAMES.map(game => game.id)).size, GAMES.length)
})
