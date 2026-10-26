const BASE_JSON = 'https://hw-media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/en'

// Article pages carry no cover field, so the hero image lives inside the body HTML.
async function articleCover (fetchJson, id) {
  try {
    const art = await fetchJson(`${BASE_JSON}/article/${id}.json`)
    const m = (art?.articleContent || '').match(/src="(https:\/\/[^"]+?\.(?:jpe?g|png|webp))"/i)
    return m ? m[1] : null
  } catch {
    return null
  }
}

export async function buildFeed({ fetchJson, game }) {
  let news = []
  let banners = []
  let events = []
  let version = {}

  if (fetchJson) {
    try {
      const menu = await fetchJson(`${BASE_JSON}/ArticleMenu.json`)
      if (Array.isArray(menu)) {
        version = { current: '3.7', next: { number: '3.8', startsAt: '2026-11-11T04:00:00.000Z' } }
        menu.sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))

        const picked = menu.slice(0, 12)
        news = await Promise.all(picked.map(async item => ({
          title: item.articleTitle,
          url: `https://wutheringwaves.kurogames.com/en/main/news/detail/${item.articleId}`,
          image: item.suggestCover || await articleCover(fetchJson, item.articleId),
          publishedAt: new Date(item.startTime.replace(' ', 'T') + '+08:00').toISOString(),
          category: item.articleTypeName || 'announcement'
        })))

        const conveneItem = menu.find(m => (m.articleTitle || '').toLowerCase().includes('convene'))
        if (conveneItem) {
          const art = await fetchJson(`${BASE_JSON}/article/${conveneItem.articleId}.json`)
          const html = art?.articleContent || ''
          const imgs = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1])

          const re = /5-Star (Resonator|Weapon):?\s*(?:<[^>]+>)*\s*([A-Za-z0-9\s]+?)(?:,|\s*<|\s*receive)/gi
          let m
          let idx = 0
          while ((m = re.exec(html)) !== null) {
            const type = m[1].toLowerCase() === 'resonator' ? 'character' : 'weapon'
            const name = m[2].trim()

            const before = html.slice(Math.max(0, m.index - 300), m.index)
            const mBanner = before.match(/\[([^\]]+)\]/g)
            const bannerTitle = mBanner ? mBanner[mBanner.length - 1].replace(/\[|\]/g, '') : name

            const after = html.slice(m.index, m.index + 800)
            const mFour = after.match(/4-Star (?:Resonators|Weapons):?\s*(?:<[^>]+>)*\s*([A-Za-z0-9\s,]+?)(?:receive|<)/i)
            const fourStars = mFour ? mFour[1].replace(/\band\b/gi, ',').split(',').map(s => s.trim()).filter(Boolean) : []

            const mDate = after.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2})\s*-\s*([0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2})/)
            const startsAt = mDate ? new Date(mDate[1].replace(' ', 'T') + '+08:00').toISOString() : new Date().toISOString()
            const endsAt = mDate ? new Date(mDate[2].replace(' ', 'T') + '+08:00').toISOString() : new Date().toISOString()

            banners.push({
              type,
              name: `${bannerTitle}: ${name}`,
              startsAt,
              endsAt,
              featured: [name, ...fourStars],
              image: imgs[idx] || null
            })
            idx++
          }
        }
      }
    } catch (e) {
      console.warn('[wuthering-waves] live fetch failed:', e.message)
    }
  }

  return {
    gameId: game.id,
    gameName: game.name,
    version,
    banners,
    events,
    news,
    syncedAt: new Date().toISOString(),
  }
}
