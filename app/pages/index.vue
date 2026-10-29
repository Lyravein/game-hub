<script setup>
import GAMES from '../../games.config.js'

const { data, error } = await useFetch('/api/feed')
const active = useState('active-game', () => GAMES[0]?.id)
const feed = computed(() => data.value?.games?.find(g => g.gameId === active.value))
const now = useNow()
const countdown = useCountdown()

const stars = ref([])
if (import.meta.client) {
  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const count = window.innerWidth < 640 ? 45 : 85
    stars.value = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (Math.random() * 100).toFixed(1),
      y: (Math.random() * 100).toFixed(1),
      size: (Math.random() * 1.6 + 0.6).toFixed(1),
      dur: (Math.random() * 3.5 + 2.5).toFixed(1),
      delay: (Math.random() * 4).toFixed(1),
      opacity: (Math.random() * 0.4 + 0.2).toFixed(2)
    }))
  })
}

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

const bannerSections = computed(() => [
  { key: 'ongoing', title: 'Ongoing', items: ongoingBanners.value, empty: 'No ongoing banners right now.' },
  { key: 'upcoming', title: 'Upcoming', items: upcomingBanners.value, empty: 'No upcoming banners announced yet.' }
])

const ongoingEvents = computed(() => {
  const list = feed.value?.events || []
  const t = now.value
  return list.filter(e => {
    const s = Date.parse(e.startsAt)
    const end = Date.parse(e.endsAt)
    return s <= t && end > t
  })
})

const upcomingEvents = computed(() => {
  const list = feed.value?.events || []
  const t = now.value
  return list.filter(e => Date.parse(e.startsAt) > t)
})

const eventSections = computed(() => [
  { key: 'ongoing', title: 'Ongoing', items: ongoingEvents.value, empty: 'No ongoing events right now.' },
  { key: 'upcoming', title: 'Upcoming', items: upcomingEvents.value, empty: 'No upcoming events announced yet.' }
])

function splitByType (list) {
  const characters = list.filter(b => b.type === 'character')
  const weapons = list.filter(b => b.type !== 'character')
  return [
    characters.length ? { label: 'Characters', items: characters } : null,
    weapons.length ? { label: 'Weapons', items: weapons } : null
  ].filter(Boolean)
}

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

function eventCountdown (e) {
  const s = Date.parse(e.startsAt)
  const end = Date.parse(e.endsAt)
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
  if (t <= end) {
    return countdown(e.endsAt)
  }
  return 'ended'
}

function getArtFallback (img) {
  if (!img) return `/game-hub/art/${active.value}.jpg`
  // Remote art is proxied: game CDNs reject hotlinked <img> requests.
  return img.startsWith('http') ? `/game-hub/api/img?u=${encodeURIComponent(img)}` : img
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
      <div class="stars" aria-hidden="true">
        <span
          v-for="s in stars"
          :key="s.id"
          class="star"
          :style="{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            '--tw-dur': `${s.dur}s`,
            '--tw-delay': `${s.delay}s`,
            opacity: s.opacity
          }"
        />
      </div>

      <nav class="nav">
        <div class="nav-inner">
          <a href="/game-hub/" class="brand">
            <span class="brand-dot"></span>
            <span>Lyravein <span class="brand-sub">Game Hub</span></span>
          </a>
          <div class="nav-links">
            <a href="#version" class="nav-link">Version</a>
            <a href="#banners" class="nav-link">Banners</a>
            <a href="#events" class="nav-link">Events</a>
            <a href="#news" class="nav-link">News</a>
            <a href="https://lyravein.my.id/" class="nav-link nav-external" target="_blank" rel="noopener">Portfolio ↗</a>
          </div>
        </div>
      </nav>

      <main class="wrap">
        <section class="hero">
          <div class="hero-eyebrow">
            <span class="eyebrow-dot"></span>
            Live Tracker // Multi-Game Radar
          </div>
          <h1>Live game info, <span class="hero-gradient">in one place.</span></h1>
          <p class="lead">Real-time banners, active events, reward overviews, and version schedules across your roster.</p>
          <div class="games-bar" role="tablist" aria-label="Select Game">
            <button
              v-for="g in GAMES"
              :key="g.id"
              class="game-tab"
              :class="{ active: g.id === active }"
              role="tab"
              :aria-selected="g.id === active"
              @click="active = g.id"
            >
              <span v-if="g.id === active" class="tab-indicator"></span>
              {{ g.name }}
            </button>
          </div>
        </section>

        <template v-if="feed">
          <section id="version" class="block">
            <div class="section-header">
              <h2 class="section-title">Next Version</h2>
              <span class="section-tag">Schedule</span>
            </div>
            <div
              v-if="feed.version?.next?.startsAt"
              class="next-version-card"
              :style="{
                backgroundImage: `url('${getArtFallback(feed.version.image)}')`
              }"
            >
              <div class="next-version-overlay">
                <div class="next-version-top">
                  <span class="ver-badge">
                    <span class="pulse-dot"></span>
                    Upcoming Major Update
                  </span>
                  <div class="ver-countdown-chip">
                    <span>⏱</span>
                    {{ countdown(feed.version.next.startsAt) }}
                  </div>
                </div>
                <div class="ver-main-row">
                  <div class="ver-numbers">
                    <span>{{ feed.version.current ? `v${feed.version.current}` : 'Current' }}</span>
                    <span class="ver-arrow">→</span>
                    <span>v{{ feed.version.next.number }}</span>
                  </div>
                  <div class="ver-meta-group">
                    <span class="ver-date">{{ fmtDate(feed.version.next.startsAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="empty-box">
              <span class="empty-icon">✦</span>
              Next version schedule is not yet confirmed.
            </div>
          </section>

          <section id="banners" class="block">
            <div class="section-header">
              <h2 class="section-title">Character &amp; Weapon Banners</h2>
              <span class="section-tag">Gacha</span>
            </div>

            <div v-for="sec in bannerSections" :key="sec.key" class="banner-group">
              <div class="group-title">
                <span v-if="sec.key === 'ongoing'" class="pulse-dot"></span>
                <span v-else class="calendar-icon">⏳</span>
                <h3>{{ sec.title }}</h3>
              </div>

              <template v-if="sec.items.length">
                <template v-for="sub in splitByType(sec.items)" :key="sub.label">
                  <div class="type-divider">
                    <span>{{ sub.label }}</span>
                  </div>
                  <div class="grid">
                    <div v-for="b in sub.items" :key="b.name + b.startsAt" class="card">
                      <div class="card-media">
                        <img
                          :src="getArtFallback(b.image)"
                          :alt="b.name"
                          loading="lazy"
                          @error="onImgError"
                        />
                        <div class="card-media-fade"></div>
                        <div class="card-badges">
                          <span class="tag" :class="b.type">{{ b.type }}</span>
                          <span class="badge" :class="sec.key === 'ongoing' ? 'badge-ongoing' : 'badge-upcoming'">
                            {{ sec.title }}
                          </span>
                        </div>
                      </div>
                      <div class="card-body">
                        <div>
                          <h3>{{ b.name }}</h3>
                          <div v-if="b.featured?.length" class="chips">
                            <span v-for="f in b.featured" :key="f.name || f" class="chip-featured">
                              <img
                                v-if="f.image"
                                :src="getArtFallback(f.image)"
                                :alt="f.name"
                                class="chip-avatar"
                                loading="lazy"
                                @error="e => e.target.remove()"
                              />
                              {{ f.name || f }}
                            </span>
                          </div>
                        </div>
                        <div class="banner-bottom">
                          <div class="meta-dates">{{ fmtDate(b.startsAt) }} → {{ fmtDate(b.endsAt) }}</div>
                          <div
                            class="countdown-badge"
                            :class="sec.key === 'ongoing' ? 'ongoing' : 'upcoming'"
                          >
                            {{ bannerCountdown(b) }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </template>
              <div v-else class="empty-box">
                <span class="empty-icon">✦</span>
                {{ sec.empty }}
              </div>
            </div>
          </section>

          <section id="events" class="block">
            <div class="section-header">
              <h2 class="section-title">Events &amp; Activities</h2>
              <span class="section-tag">Activities</span>
            </div>

            <div v-for="sec in eventSections" :key="sec.key" class="banner-group">
              <div class="group-title">
                <span v-if="sec.key === 'ongoing'" class="pulse-dot"></span>
                <span v-else class="calendar-icon">⏳</span>
                <h3>{{ sec.title }}</h3>
              </div>

              <div v-if="sec.items.length" class="grid">
                <div v-for="e in sec.items" :key="e.name + e.startsAt" class="card">
                  <div class="card-media">
                    <img
                      :src="getArtFallback(e.image)"
                      :alt="e.name"
                      loading="lazy"
                      @error="onImgError"
                    />
                    <div class="card-media-fade"></div>
                    <div class="card-badges">
                      <span class="badge" :class="sec.key === 'ongoing' ? 'badge-ongoing' : 'badge-upcoming'">
                        {{ sec.title }} Event
                      </span>
                      <a v-if="e.url" :href="e.url" target="_blank" rel="noopener" class="event-link">Details ↗</a>
                    </div>
                  </div>
                  <div class="card-body">
                    <div>
                      <h3>{{ e.name }}</h3>
                      <div v-if="e.rewards?.length" class="chips">
                        <span v-for="r in e.rewards" :key="r" class="chip-reward">{{ r }}</span>
                      </div>
                    </div>
                    <div class="banner-bottom">
                      <div class="meta-dates">{{ fmtDate(e.startsAt) }} → {{ fmtDate(e.endsAt) }}</div>
                      <div
                        class="countdown-badge"
                        :class="sec.key === 'ongoing' ? 'ongoing' : 'upcoming'"
                      >
                        {{ eventCountdown(e) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="empty-box">
                <span class="empty-icon">✦</span>
                {{ sec.empty }}
              </div>
            </div>
          </section>

          <section id="news" class="block">
            <div class="section-header">
              <h2 class="section-title">Latest Announcements</h2>
              <span class="section-tag">Official Feed</span>
            </div>
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
                  <div class="card-media-fade"></div>
                </div>
                <div class="card-body">
                  <h3>{{ n.title }}</h3>
                  <div class="news-meta-row">
                    <span>{{ fmtDate(n.publishedAt) }}</span>
                    <span class="news-link-hint">Read ↗</span>
                  </div>
                </div>
              </a>
            </div>
            <div v-else class="empty-box">
              <span class="empty-icon">✦</span>
              No news items available yet.
            </div>
          </section>
        </template>
        <div v-else class="empty-box">
          <span class="empty-icon">✦</span>
          {{ error ? 'Sync in progress, try again later.' : 'Loading game telemetry...' }}
        </div>
      </main>

      <footer class="footer">
        <div class="footer-inner">
          <div class="footer-sync">
            <span class="footer-sync-dot"></span>
            Last synced: {{ data?.syncedAt ? fmtDate(data.syncedAt) : 'never' }}
          </div>
          <div class="footer-links">
            <a href="https://lyravein.my.id/">Main Portfolio</a>
            <span>·</span>
            <a href="#version">Version</a>
            <span>·</span>
            <a href="#banners">Banners</a>
            <span>·</span>
            <a href="#events">Events</a>
            <span>·</span>
            <a href="#news">News</a>
          </div>
          <div class="footer-note">
            Data sourced from official game feeds, wikis, and game APIs (best-effort).
          </div>
        </div>
      </footer>
    </NuxtLayout>
  </Html>
</template>
