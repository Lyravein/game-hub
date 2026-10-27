// Local-only helper: prydwen.gg passes a home IP but answers Cloudflare's managed challenge to
// datacenter IPs (the VPS gets 403), and Node's fetch is challenged anywhere. So this runs on the
// laptop with curl, writes the Arc banner overrides to data/manual/nte.json, and re-syncs the feed.
// The VPS hourly sync merges that same manual file, so the Arc cards survive there too.
import { execFile } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PAGE = 'https://www.prydwen.gg/neverness-to-everness/banners'
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const MAX_FEATURED = 8
const run = promisify(execFile)

const decode = (s) => String(s).replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' })[k]).trim()

export function parsePrydwenBanners(html) {
  const out = []
  for (const raw of String(html).split('data-banner-card="true"').slice(1)) {
    const chunk = raw.split('</article>')[0]
    const name = decode((chunk.match(/class="banner-name">([^<]+)</) || [])[1] || '')
    const startsAt = (chunk.match(/data-start-eu="([^"]+)"/) || [])[1]
    const endsAt = (chunk.match(/data-end-eu="([^"]+)"/) || [])[1]
    if (!name || !startsAt || !endsAt) continue
    out.push({
      type: /data-category="weapon"/.test(chunk) ? 'weapon' : 'character',
      name,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      image: (chunk.match(/<img[^>]+src="(https:\/\/cdn\.prydwen\.gg\/[^"]+)"/) || [])[1] || null,
      featured: [...chunk.matchAll(/class="featured-rate-up"[^>]*>([^<]+)</g)].map(m => decode(m[1])).slice(0, MAX_FEATURED),
    })
  }
  return out
}

async function main() {
  const { stdout } = await run('curl', ['-sS', '--max-time', '30', '-A', UA, PAGE], { maxBuffer: 64 * 1024 * 1024 }).catch(() => ({ stdout: '' }))
  const banners = parsePrydwenBanners(stdout)
    .filter(b => b.type === 'weapon' && Date.parse(b.endsAt) > Date.now())
    .sort((x, y) => Date.parse(x.startsAt) - Date.parse(y.startsAt))

  if (!banners.length) {
    console.error('[prydwen] no Arc banner parsed; page likely served a challenge, manual file left untouched')
    process.exitCode = 1
    return
  }

  const target = join(ROOT, 'data/manual/nte.json')
  writeFileSync(target, `${JSON.stringify({ banners }, null, 2)}\n`)
  console.log(`[prydwen] ${banners.length} arc banner -> ${target}`)

  await run(process.execPath, ['scripts/sync.js', 'nte'], { cwd: ROOT, stdio: 'inherit' })

  // Push the manual file so the VPS hourly sync merges it too.
  await run('rsync', ['-az', `${join(ROOT, 'data')}/`, 'lyravein@100.111.77.5:~/game-hub/data/'])
    .then(() => console.log('[prydwen] pushed data/ to the VPS'))
    .catch(e => console.warn(`[prydwen] push to VPS failed: ${e.message.split('\n')[0]}`))
}

// Importable by tests: only touch the network when executed directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) await main()