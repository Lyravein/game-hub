import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseNteNews, parseNteBanners } from '../scripts/games/nte.js'
import { parsePrydwenBanners } from '../scripts/local/prydwen-nte.js'

const listHtml = `<div class="listNews">
  <a class="x" href="/en/article/news/gamenews/20261019/264675.html"><div class="listItem"><div><h2 class="title">Server Maintenance Notice: October 21</h2><div class="des">dup</div></div><div><p class="date">2026-10-19</p><p class="type">News</p></div></div></a>
  <a class="x" href="/en/article/news/gameevent/20260929/264427.html"><div class="listItem"><div><h2 class="title">Version 1.4 NTE x Porsche Fan Creation Contest</h2><div class="des">dup</div></div><div><p class="date">2026-09-29</p><p class="type">Events</p></div></div></a>
  <a class="x" href="/en/article/news/gamebroad/20260801/260001.html"><div class="listItem"><div><h2 class="title">Row without a type</h2></div></div></a>
</div>`

// The tracker streams its records as escaped strings, split across several push() chunks.
const record = '{"version":"1.4","phase":"Phase 2","slug":"akane-rin","name":"Akane Rin","type":"New Character","startDate":"2026-10-21T10:00:00+08:00","plannedEndDate":"2026-11-11T05:59:00+08:00","gacha":"/images/drip-marketing/drip-akane.webp"}'
const cut = record.indexOf('"type"')
const undated = '{"version":"1.5","phase":"Phase 1","name":"Elyms","type":"New Character"}'
const bannerHtml = [
  `<script>self.__next_f.push([1,${JSON.stringify(record.slice(0, cut))}])</script>`,
  `<script>self.__next_f.push([1,${JSON.stringify(record.slice(cut))}])</script>`,
  `<script>self.__next_f.push([1,${JSON.stringify(undated)}])</script>`
].join('')

test('parseNteNews reads the official list and skips rows without a date', () => {
  const news = parseNteNews(listHtml)
  assert.deepEqual(news.map(n => n.title), ['Server Maintenance Notice: October 21', 'Version 1.4 NTE x Porsche Fan Creation Contest'])
  assert.equal(news[0].url, 'https://nte.perfectworld.com/en/article/news/gamenews/20261019/264675.html')
  assert.equal(news[1].category, 'events')
})

test('parsePrydwenBanners keeps the Arc card with its date range and art', () => {
  const html = '<div><article class="banner-card weapon-banner-card" data-banner-card="true" data-category="weapon" data-section="current"><img src="https://cdn.prydwen.gg/images/nte/banners/arc.webp" alt=""/><p class="banner-name">Far Side of the Moon</p><div class="art-timer" data-start-eu="2026-10-21T03:00:00.000Z" data-end-eu="2026-11-11T21:59:00.000Z"></div><a class="featured-rate-up" href="/x">Far Side of the Moon</a></article></div>'
  const banners = parsePrydwenBanners(html)
  assert.equal(banners.length, 1)
  assert.equal(banners[0].type, 'weapon')
  assert.equal(banners[0].name, 'Far Side of the Moon')
  assert.equal(banners[0].image, 'https://cdn.prydwen.gg/images/nte/banners/arc.webp')
  assert.deepEqual(banners[0].featured, ['Far Side of the Moon'])
})

test('parseNteBanners joins the flight chunks and keeps only dated banners', () => {
  const banners = parseNteBanners(bannerHtml)
  assert.deepEqual(banners.map(b => b.name), ['Akane Rin'])
  assert.equal(banners[0].startsAt, '2026-10-21T02:00:00.000Z')
  assert.equal(banners[0].endsAt, '2026-11-10T21:59:00.000Z')
  assert.equal(banners[0].image, 'https://www.ntebuild.com/images/drip-marketing/drip-akane.webp')
})