// Arknights EN (YoStar) events from ArknightsAssets/ArknightsGamedata (arkprts auto-fetcher, master).
// Verified 2026-10-18: 200 OK, ~18MB, repo pushed 2 days before. (Kengxxiao/ArknightsGameData_YoStar is ~10 months stale.)
// ponytail: banners empty (gacha_table format varies); rewards left to manual override.
const BASE = 'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel'
const SKIP_TYPES = new Set([
  'CHECKIN_ONLY', 'LOGIN_ONLY', 'CHECKIN_ACCESS', 'PRAY_ONLY', 'CHECKIN_VS',
  'CHECKIN_ALL_PLAYER', 'CHECKIN_VIDEO', 'SWITCH_ONLY', 'UNIQUE_ONLY', 'MISSION_ONLY',
])

export async function buildFeed({ fetchJson, game }) {
  const t = await fetchJson(`${BASE}/activity_table.json`)
  const now = Date.now()
  const events = Object.values(t.basicInfo ?? {})
    .filter(a => a?.name && a.startTime && a.endTime && !SKIP_TYPES.has(a.type) && !a.isReplicate)
    .map(a => ({ name: a.name, startsAt: new Date(a.startTime * 1000).toISOString(), endsAt: new Date(a.endTime * 1000).toISOString(), rewards: [], url: '' }))
    .filter(e => Date.parse(e.endsAt) > now)
    .sort((x, y) => Date.parse(x.endsAt) - Date.parse(y.endsAt))
    .slice(0, 10)
  return {
    gameId: 'arknights', gameName: game.name, version: {},
    banners: [], events,
    news: [], // ponytail: no free EN news feed; fill via data/manual/arknights.json
    syncedAt: new Date().toISOString(),
  }
}
