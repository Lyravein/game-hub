// Game CDNs block hotlinked <img> requests, so assets are fetched server-side.
// Only hosts used by the game adapters are allowed (no open proxy).
const ALLOWED = [
  'hoyolab.com',
  'hycdn.cn',
  'kurogame.com',
  'hg-cdn.com',
  'gryphline.com',
  'hypergryph.com',
  'yo-star.com',
  'perfectworld.com',
  'wiki.gg',
  'ntebuild.com'
]

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).u
  let target
  try {
    target = new URL(String(raw || ''))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'bad url' })
  }
  if (target.protocol !== 'https:' || !ALLOWED.some(h => target.hostname === h || target.hostname.endsWith(`.${h}`))) {
    throw createError({ statusCode: 403, statusMessage: 'host not allowed' })
  }

  const res = await fetch(target, { headers: { 'user-agent': 'game-hub/0.1' } })
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: `upstream ${res.status}` })

  setHeader(event, 'content-type', res.headers.get('content-type') || 'image/jpeg')
  setHeader(event, 'cache-control', 'public, max-age=86400, s-maxage=604800')
  return new Uint8Array(await res.arrayBuffer())
})