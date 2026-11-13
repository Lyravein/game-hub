import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function computeImageHash(url) {
  return createHash('sha256').update(String(url || '').trim()).digest('hex')
}

export function loadVisionCache(cachePath) {
  if (!cachePath || !existsSync(cachePath)) return {}
  try {
    return JSON.parse(readFileSync(cachePath, 'utf8')) || {}
  } catch {
    return {}
  }
}

export function saveVisionCache(cachePath, cache) {
  if (!cachePath) return
  const dir = join(cachePath, '..')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8')
}

export async function extractCardFromImage({
  imageUrl,
  gameId,
  env = process.env,
  fetchImpl = globalThis.fetch,
  cachePath
}) {
  if (!imageUrl) return { ok: false, reason: 'missing_image_url' }

  const apiBase = env.VISION_API_BASE
  const apiKey = env.VISION_API_KEY
  const model = env.VISION_MODEL

  if (!apiBase || !apiKey || !model) {
    return { ok: false, reason: 'unconfigured' }
  }

  const hash = computeImageHash(imageUrl)
  let cache = {}
  if (cachePath) {
    cache = loadVisionCache(cachePath)
    if (cache[hash]) {
      return { ok: true, cached: true, hash, data: cache[hash] }
    }
  }

  const prompt = `Analyze this game announcement image for the game "${gameId || 'gacha'}".
Extract any character/weapon banners or scheduled events with their start and end dates (in ISO format UTC if possible or best estimate).
Return strictly a valid JSON object matching this schema:
{
  "banners": [
    {
      "type": "character" or "weapon",
      "name": "banner title",
      "featured": ["character or weapon name"],
      "startsAt": "ISO date string or null",
      "endsAt": "ISO date string or null"
    }
  ],
  "events": [
    {
      "name": "event name",
      "startsAt": "ISO date string or null",
      "endsAt": "ISO date string or null",
      "rewards": ["reward name and count"]
    }
  ]
}
No other text, markdown, or explanation.`

  try {
    const endpoint = apiBase.replace(/\/+$/, '') + '/chat/completions'
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.1
      })
    })

    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}` }
    }

    const raw = typeof res.text === 'function' ? await res.text() : await res.json()
    const cleanStream = typeof raw === 'string' ? raw.replace(/data:\s*\[DONE\][\s\S]*$/, '').trim() : JSON.stringify(raw)
    const payload = JSON.parse(cleanStream)
    const content = payload?.choices?.[0]?.message?.content || ''
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON object found in response')
    const parsed = JSON.parse(match[0])

    const isValidIso = str => typeof str === 'string' && !Number.isNaN(Date.parse(str))

    const cleanBanners = (Array.isArray(parsed?.banners) ? parsed.banners : [])
      .filter(b => b && typeof b.name === 'string' && (b.type === 'character' || b.type === 'weapon'))
      .map(b => ({
        ...b,
        startsAt: isValidIso(b.startsAt) ? new Date(b.startsAt).toISOString() : new Date().toISOString(),
        endsAt: isValidIso(b.endsAt) ? new Date(b.endsAt).toISOString() : new Date(Date.now() + 14 * 86400000).toISOString()
      }))

    const cleanEvents = (Array.isArray(parsed?.events) ? parsed.events : [])
      .filter(e => e && typeof e.name === 'string')
      .map(e => ({
        ...e,
        startsAt: isValidIso(e.startsAt) ? new Date(e.startsAt).toISOString() : new Date().toISOString(),
        endsAt: isValidIso(e.endsAt) ? new Date(e.endsAt).toISOString() : new Date(Date.now() + 14 * 86400000).toISOString()
      }))

    const resultData = {
      banners: cleanBanners,
      events: cleanEvents
    }

    if (cachePath) {
      cache[hash] = resultData
      saveVisionCache(cachePath, cache)
    }

    return { ok: true, cached: false, hash, data: resultData }
  } catch (err) {
    return { ok: false, reason: err.message || 'parse_failure' }
  }
}
