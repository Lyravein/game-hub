import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseWikiEvents, parseWikiBanners } from '../scripts/games/arknights.js'

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

const bannerWikitext = `{{Banners head}}
{{Banners cell
|type = celebration
|name = Sealed With Time
|globalstart = 2026/10/14 08:00:00
|globalend = 2026/10/28 03:59:59
|operators = Closure, Crackborne, Exusiai the New Covenant}}
{{Banners cell
|type = orient
|no = 7
|globalstart = 2026/10/28 08:00:00
|globalend = 2026/11/11 03:59:59}}
{{Banners cell
|type = standard
|name = Standard Pool #178 (Global)
|operators = Someone, Someone Else}}
{{Banners cell
|type = special
|name = Undated Banner
|cnstart = 2026/07/10
|operators = Aphrissa}}
{{Table end}}`

test('parseWikiEvents keeps only cells with a global start date', () => {
  const events = parseWikiEvents(wikitext)
  assert.deepEqual(events.map(e => e.name), ['Critical Phase Transition', "The Masses' Travels Rerun"])
  assert.equal(events[1].startsAt, '2026-11-05T11:00:00.000Z')
  assert.equal(events[0].endsAt, '2026-10-28T10:59:59.000Z')
})

test('parseWikiBanners keeps dated non-rotating banners and their rate-up Operators', () => {
  const banners = parseWikiBanners(bannerWikitext)
  assert.deepEqual(banners.map(b => b.name), ['Sealed With Time', 'Orienteering #7'])
  assert.deepEqual(banners[0].featured, ['Closure', 'Crackborne', 'Exusiai the New Covenant'])
  assert.deepEqual(banners[1].featured, [])
  assert.equal(banners[1].startsAt, '2026-10-28T15:00:00.000Z')
})