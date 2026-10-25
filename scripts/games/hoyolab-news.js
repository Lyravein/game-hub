// HoYoLAB news API, verified 2026-10-18: GET getNewsList?gids=<gid>&type=1&page_size=N
// gids: 2 = Genshin Impact, 6 = Honkai: Star Rail, 8 = Zenless Zone Zero
export async function fetchNews({ fetchJson, gid, pageSize = 12 }) {
  const data = await fetchJson(`https://bbs-api-os.hoyolab.com/community/post/wapi/getNewsList?gids=${gid}&type=1&page_size=${pageSize}`)
  if (data.retcode !== 0) throw new Error(`hoyolab retcode ${data.retcode}`)
  return (data.data?.list ?? []).map(item => ({
    title: item.post?.subject ?? '(untitled)',
    url: `https://www.hoyolab.com/article/${item.post?.post_id}`,
    image: item.cover_list?.[0]?.url || item.image_list?.[0]?.url || item.post?.cover || item.cover?.url || null,
    publishedAt: new Date(Number(item.post?.created_at ?? 0) * 1000).toISOString(),
    category: 'announcement',
  }))
}
