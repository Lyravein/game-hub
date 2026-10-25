import { fetchNews } from './hoyolab-news.js'

async function fetchBannersFromAnnouncements({ fetchJson, newsList }) {
  const channelPost = newsList.find(n => n.title.includes('Limited-Time Channels') || n.title.includes('Signal Search'))
  if (!channelPost) return []
  const postId = channelPost.url.split('/').pop()
  try {
    const res = await fetchJson(`https://bbs-api-os.hoyolab.com/community/post/wapi/getPostFull?post_id=${postId}`)
    const raw = res.data?.post?.post?.structured_content
    if (!raw) return []
    const blocks = JSON.parse(raw)
    const fullText = blocks.map(b => typeof b.insert === 'string' ? b.insert : '').join('')
    const mDate = fullText.match(/period is as follows:\s*(.+?)–\s*([0-9]{4}\/[0-9]{2}\/[0-9]{2}\s+[0-9]{2}:[0-9]{2})/i)
    const endsAt = mDate ? new Date(mDate[2].replace(/\//g, '-') + ':00Z').toISOString() : new Date(Date.now() + 20 * 86400e3).toISOString()
    const startsAt = channelPost.publishedAt

    const indices = []
    for (let i = 0; i < blocks.length; i++) {
      if (typeof blocks[i].insert === 'string' && blocks[i].insert.includes('Signal Search Details')) {
        indices.push(i)
      }
    }

    const banners = []
    for (let k = 0; k < indices.length; k++) {
      const startIdx = indices[k]
      const endIdx = k + 1 < indices.length ? indices[k + 1] : blocks.length
      const headerText = blocks[startIdx].insert
      const cleanName = headerText.replace(/[\n"']/g, '').replace(/Signal Search Details/i, '').trim()

      let img = null
      let charName = null
      let type = 'character'

      for (let j = startIdx; j < endIdx; j++) {
        if (typeof blocks[j].insert === 'string') {
          const mChar = blocks[j].insert.match(/limited S-Rank (Agent|W-Engine)\s+([^(]+)/i)
          if (mChar) {
            type = mChar[1].toLowerCase() === 'agent' ? 'character' : 'weapon'
            charName = mChar[2].trim()
          }
        }
        if (blocks[j].insert?.image && !img) {
          img = blocks[j].insert.image
        }
      }

      banners.push({
        type,
        name: cleanName || `Signal Search ${k + 1}`,
        startsAt,
        endsAt,
        featured: charName ? [charName] : [],
        image: img,
      })
    }
    return banners
  } catch (e) {
    console.warn('[zzz] banner parse failed:', e.message)
    return []
  }
}

export async function buildFeed({ fetchJson, game }) {
  const news = await fetchNews({ fetchJson, gid: 8 })
  let banners = []
  try {
    banners = await fetchBannersFromAnnouncements({ fetchJson, newsList: news })
  } catch (e) {
    console.warn('[zzz] auto banner fetch failed:', e.message)
  }
  return {
    gameId: 'zzz',
    gameName: game.name,
    version: {},
    banners,
    events: [],
    news,
    syncedAt: new Date().toISOString(),
  }
}
