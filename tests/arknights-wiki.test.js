import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseWikiEvents } from '../scripts/games/arknights.js'

// Global dates on the wiki are UTC-7; cells without a globalstart are CN-only and must be skipped.
const wikitext = `{{Onup events head}}
{{Onup events cell
|type = celebration
|name = Critical Phase Transition
|cnstart = 2026/05/01
|globalstart = 2026/10/14 08:00:00
|globalend = 2026/10/28 03:59:59}}
{{Onup events cell
|name = The Masses' Travels Rerun
|cnstart = 2026/05/22
|globalstart = 2026/11/05 04:00:00
|globalend = 2026/11/15 03:59:59}}
{{Upcoming events cell
|name = Nothing Dated
|cnstart = 2026/06/26}}
{{Table end}}`

test('parseWikiEvents keeps only cells with a global start date', () => {
  const events = parseWikiEvents(wikitext)
  assert.deepEqual(events.map(e => e.name), ['Critical Phase Transition', "The Masses' Travels Rerun"])
  assert.equal(events[1].startsAt, '2026-11-05T11:00:00.000Z')
  assert.equal(events[0].endsAt, '2026-10-28T10:59:59.000Z')
})