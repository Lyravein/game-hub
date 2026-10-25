<script setup>
import GAMES from '../../games.config.js'

const { data, error } = await useFetch('/api/feed')
const active = useState('active-game', () => GAMES[0]?.id)
const feed = computed(() => data.value?.games?.find(g => g.gameId === active.value))
const now = useNow()
const countdown = useCountdown()

const ongoingBanners = computed(() => {
  const list = feed.value?.banners || []
  const t = now.value
  return list.filter(b => {
    const s = Date.parse(b.startsAt)
    const e = Date.parse(b.endsAt)
    return s <= t && e > t
  })
})

const upcomingBanners = computed(() => {
  const list = feed.value?.banners || []
  const t = now.value
  return list.filter(b => Date.parse(b.startsAt) > t)
})

function bannerCountdown (b) {
  const s = Date.parse(b.startsAt)
  const e = Date.parse(b.endsAt)
  const t = now.value
  if (t < s) {
    const ms = s - t
    const d = Math.floor(ms / 86400e3)
    const h = Math.floor(ms % 86400e3 / 3600e3)
    const m = Math.floor(ms % 3600e3 / 60e3)
    if (d > 0) return `starts in ${d}d ${h}h`
    if (h > 0) return `starts in ${h}h ${m}m`
    return `starts in ${m}m`
  }
  if (t <= e) {
    return countdown(b.endsAt)
  }
  return 'ended'
}

function getArtFallback (img) {
  return img || `/game-hub/art/${active.value}.jpg`
}

function onImgError (e) {
  const fallback = `/game-hub/art/${active.value}.jpg`
  if (e.target && !e.target.src.endsWith(fallback)) {
    e.target.src = fallback
  }
}
</script>

<template>
  <Html lang="en">
    <NuxtLayout>
      <nav class="nav">
        <span class="brand">🎮 Lyravein Game Hub</span>
      </nav>
      <main class="wrap">
        <section class="hero">
          <h1>Live game info, in one place.</h1>
          <p>banners · events · rewards · news · next version</p>
          <div class="games">
            <button
              v-for="g in GAMES"
              :key="g.id"
              :class="{ active: g.id === active }"
              @click="active = g.id"
            >{{ g.name }}</button>
          </div>
        </section>

        <template v-if="feed">
          <section class="block">
            <h2>Next Version</h2>
            <div
              v-if="feed.version?.next?.startsAt"
              class="next-version"
              :style="{
                backgroundImage: `linear-gradient(90deg, rgba(6, 10, 18, 0.92) 0%, rgba(11, 18, 32, 0.72) 45%, rgba(6, 10, 18, 0.88) 100%), url('${feed.version.image || `/game-hub/art/${active}.jpg`}')`
              }"
            >
              <span class="ver-label">Upcoming Version Update</span>
              <div class="ver-main">
                <span class="ver">{{ feed.version.current || '' }} → {{ feed.version.next.number }}</span>
                <span class="when">{{ fmtDate(feed.version.next.startsAt) }}</span>
                <span class="countdown">{{ countdown(feed.version.next.startsAt) }}</span>
              </div>
            </div>
            <p v-else class="empty">Next version date not set yet.</p>
          </section>

          <section class="block">
            <h2>Character & Weapon Banners</h2>

            <div class="banner-group">
              <div class="group-title">
                <span class="pulse-dot"></span>
                <h3>Ongoing</h3>
              </div>
              <div v-if="ongoingBanners.length" class="grid">
                <div v-for="b in ongoingBanners" :key="b.name + b.startsAt" class="card banner-card">
                  <div class="card-media">
                    <img
                      :src="getArtFallback(b.image)"
                      :alt="b.name"
                      @error="onImgError"
                    />
                    <div class="card-badges">
                      <span class="tag" :class="b.type">{{ b.type }}</span>
                      <span class="badge badge-ongoing">Ongoing</span>
                    </div>
                  </div>
                  <div class="card-body">
                    <div>
                      <h3>{{ b.name }}</h3>
                      <div v-if="b.featured?.length" class="chips">
                        <span v-for="f in b.featured" :key="f" class="chip-featured">{{ f }}</span>
                      </div>
                    </div>
                    <div class="banner-bottom">
                      <div class="meta">{{ fmtDate(b.startsAt) }} → {{ fmtDate(b.endsAt) }}</div>
                      <div class="meta countdown">{{ bannerCountdown(b) }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <p v-else class="empty">No ongoing banners right now.</p>
            </div>

            <div class="banner-group">
              <div class="group-title">
                <span class="calendar-icon">⏳</span>
                <h3>Upcoming</h3>
              </div>
              <div v-if="upcomingBanners.length" class="grid">
                <div v-for="b in upcomingBanners" :key="b.name + b.startsAt" class="card banner-card">
                  <div class="card-media">
                    <img
                      :src="getArtFallback(b.image)"
                      :alt="b.name"
                      @error="onImgError"
                    />
                    <div class="card-badges">
                      <span class="tag" :class="b.type">{{ b.type }}</span>
                      <span class="badge badge-upcoming">Upcoming</span>
                    </div>
                  </div>
                  <div class="card-body">
                    <div>
                      <h3>{{ b.name }}</h3>
                      <div v-if="b.featured?.length" class="chips">
                        <span v-for="f in b.featured" :key="f" class="chip-featured">{{ f }}</span>
                      </div>
                    </div>
                    <div class="banner-bottom">
                      <div class="meta">{{ fmtDate(b.startsAt) }} → {{ fmtDate(b.endsAt) }}</div>
                      <div class="meta countdown-upcoming">{{ bannerCountdown(b) }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <p v-else class="empty">No upcoming banners announced yet.</p>
            </div>
          </section>

          <section class="block">
            <h2>Ongoing Events</h2>
            <div v-if="feed.events.length" class="grid">
              <div v-for="e in feed.events" :key="e.name + e.startsAt" class="card banner-card">
                <div class="card-media">
                  <img
                    :src="getArtFallback(e.image)"
                    :alt="e.name"
                    loading="lazy"
                    @error="onImgError"
                  />
                  <div class="card-badges">
                    <span class="badge badge-ongoing">Event</span>
                    <a v-if="e.url" :href="e.url" target="_blank" rel="noopener" class="event-link">Details ↗</a>
                  </div>
                </div>
                <div class="card-body">
                  <div>
                    <h3>{{ e.name }}</h3>
                    <div v-if="e.rewards?.length" class="chips">
                      <span v-for="r in e.rewards" :key="r" class="chip-featured">{{ r }}</span>
                    </div>
                  </div>
                  <div class="banner-bottom">
                    <div class="meta">{{ fmtDate(e.startsAt) }} → {{ fmtDate(e.endsAt) }}</div>
                    <div class="meta countdown">{{ countdown(e.endsAt) }}</div>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="empty">No ongoing events right now.</p>
          </section>

          <section class="block">
            <h2>News</h2>
            <div v-if="feed.news.length" class="grid">
              <a
                v-for="n in feed.news"
                :key="n.url"
                :href="n.url"
                target="_blank"
                rel="noopener"
                class="card news-card"
              >
                <div class="card-media">
                  <img
                    :src="getArtFallback(n.image)"
                    :alt="n.title"
                    loading="lazy"
                    @error="onImgError"
                  />
                </div>
                <div class="card-body">
                  <h3>{{ n.title }}</h3>
                  <div class="meta">{{ fmtDate(n.publishedAt) }}</div>
                </div>
              </a>
            </div>
            <p v-else class="empty">No news yet.</p>
          </section>
        </template>
        <p v-else class="empty">
          {{ error ? 'Sync in progress, try again later.' : 'Loading...' }}
        </p>
      </main>
      <footer class="footer">
        last synced: {{ data?.syncedAt ? fmtDate(data.syncedAt) : 'never' }} · data from official sources, best-effort
      </footer>
    </NuxtLayout>
  </Html>
</template>
