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

const redeemCodes = computed(() => {
  const t = now.value
  return (feed.value?.redeemCodes || [])
    .map(code => {
      const windows = Array.isArray(code.windows) ? code.windows : []
      const liveWindows = windows.filter(window => {
        const expiresAt = Date.parse(window?.expiresAt)
        return Number.isNaN(expiresAt) || expiresAt > t
      })
      if (windows.length > 0 && liveWindows.length === 0) return null

      const active = liveWindows.some(window => {
        const startsAt = Date.parse(window?.startsAt)
        const expiresAt = Date.parse(window?.expiresAt)
        return !Number.isNaN(startsAt) && !Number.isNaN(expiresAt) && startsAt <= t && t < expiresAt
      })
      const upcoming = liveWindows.some(window => {
        const startsAt = Date.parse(window?.startsAt)
        const expiresAt = Date.parse(window?.expiresAt)
        return !Number.isNaN(startsAt) && !Number.isNaN(expiresAt) && t < startsAt
      })
      const regions = [...new Set(liveWindows.map(window => window?.region?.trim()).filter(Boolean))]
      const status = active ? 'active' : upcoming ? 'upcoming' : 'unverified'
      const source = code.source || { name: 'Primary source', url: '' }
      if (!code.code) return null
      const key = [code.code, source.url, ...regions, code.verifiedAt].join('-')
      const rewards = Array.isArray(code.rewards) ? code.rewards : []
      const verifiedAt = code.verifiedAt && !Number.isNaN(Date.parse(code.verifiedAt)) ? fmtDate(code.verifiedAt) : null
      const statusLabel = { active: 'Active', upcoming: 'Upcoming', unverified: 'Unverified' }[status]
      return {
        ...code,
        status,
        statusLabel,
        key,
        regions,
        rewards,
        source,
        verifiedAt,
        windows: liveWindows.map(window => ({
          ...window,
          timing: redeemWindowTiming(window),
          dateRange: redeemWindowDates(window)
        }))
      }
    })
    .filter(Boolean)
})

const redeemSync = computed(() => feed.value?.redeemSync)
const redeemSyncState = computed(() => {
  if (redeemSync.value?.status === 'stale') return 'stale'
  if (redeemSync.value?.mode === 'manual-only') return 'manual'
  if (redeemSync.value?.status === 'not-configured') return 'not-configured'
  if (redeemSync.value?.status === 'ok') return 'ok'
  return 'unknown'
})
const redeemSyncTime = computed(() => {
  const value = redeemSync.value?.lastSuccessAt
  return value && !Number.isNaN(Date.parse(value)) ? fmtDate(value) : null
})
const feedSyncTime = computed(() => {
  const value = feed.value?.syncedAt
  return value && !Number.isNaN(Date.parse(value)) ? fmtDate(value) : null
})

const copiedCode = ref('')
let copyResetTimer

async function copyCode (code) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    copiedCode.value = code
    clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => { copiedCode.value = '' }, 2000)
  } catch {
    copiedCode.value = ''
  }
}

onUnmounted(() => clearTimeout(copyResetTimer))

function redeemWindowTiming (window) {
  const startsAt = Date.parse(window?.startsAt)
  const expiresAt = Date.parse(window?.expiresAt)
  const t = now.value
  if (!Number.isNaN(startsAt) && t < startsAt) return `starts in ${formatDuration(startsAt - t)}`
  if (!Number.isNaN(expiresAt) && t < expiresAt) return `expires in ${formatDuration(expiresAt - t)}`
  if (!Number.isNaN(expiresAt)) return `ended ${fmtDate(expiresAt)}`
  return 'expiry unconfirmed'
}

function redeemWindowDates (window) {
  const startsAt = window?.startsAt ? fmtDate(window.startsAt) : null
  const expiresAt = window?.expiresAt ? fmtDate(window.expiresAt) : null
  if (startsAt && expiresAt) return `${startsAt} → ${expiresAt}`
  if (expiresAt) return `Expires ${expiresAt}`
  if (startsAt) return `Starts ${startsAt}`
  return 'Expiry date not confirmed'
}

function formatDuration (ms) {
  const minutes = Math.max(1, Math.floor(ms / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

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
            <a href="#codes" class="nav-link">Codes</a>
            <a href="#news" class="nav-link">News</a>
            <a href="https://lyravein.my.id/" class="nav-link nav-external" target="_blank" rel="noopener">Portfolio ↗</a>
          </div>
        </div>
      </nav>

      <main class="wrap">
        <div v-if="error" class="feed-error" role="alert">
          Unable to load game telemetry. Redeem codes could not be refreshed—please try again later.
        </div>
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

        <template v-if="feed && !error">
          <section id="version" class="block">
            <div class="section-header">
              <span class="section-tag">01 / Next Version</span>
              <h2 class="section-title">Next <em>Version</em></h2>
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
              <span class="section-tag">02 / Banners</span>
              <h2 class="section-title">Character &amp; Weapon <em>Banners</em></h2>
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
              <span class="section-tag">03 / Activities</span>
              <h2 class="section-title">Events &amp; <em>Activities</em></h2>
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

          <section id="codes" class="block">
            <div class="section-header">
              <span class="section-tag">04 / Redeem Codes</span>
              <h2 class="section-title">Active <em>Redeem Codes</em></h2>
            </div>

            <div class="codes-sync" :class="redeemSyncState" role="status">
              <span class="codes-sync-dot" aria-hidden="true"></span>
              <span v-if="redeemSyncState === 'stale'">Source stale / using fallback data</span>
              <span v-else-if="redeemSyncState === 'manual'">Community / manual verification</span>
              <span v-else-if="redeemSyncState === 'not-configured'">Community / manual verification</span>
              <span v-else-if="redeemSyncState === 'ok'">Redeem source up to date</span>
              <span v-else>Redeem sync status unavailable</span>
              <span class="codes-sync-time">
                · Last sync: {{ redeemSyncTime || feedSyncTime || 'never' }}
              </span>
              <span v-if="redeemSyncState === 'manual' || redeemSyncState === 'not-configured'" class="codes-sync-note">
                · Codes are verified manually
              </span>
            </div>

            <div v-if="redeemCodes.length" class="codes-grid">
              <article v-for="code in redeemCodes" :key="code.key + (code.source?.name || '')" class="code-card">
                <div class="code-header">
                  <span class="status-badge" :class="code.status">{{ code.statusLabel }}</span>
                  <span v-if="code.regions.length" class="code-regions">
                    <span v-for="region in code.regions" :key="region" class="region-badge">{{ region }}</span>
                  </span>
                </div>

                <div class="code-value-row">
                  <code class="code-value">{{ code.code }}</code>
                  <button
                    type="button"
                    class="code-copy-btn"
                    :aria-label="`Copy redeem code ${code.code}`"
                    @click="copyCode(code.code)"
                  >
                    {{ copiedCode === code.code ? 'Copied!' : 'Copy' }}
                  </button>
                </div>

                <div v-if="code.verifiedAt" class="code-verified">
                  Verified {{ code.verifiedAt }}
                </div>

                <div v-if="code.windows.length" class="code-windows">
                  <div v-for="(window, index) in code.windows" :key="window.region + index" class="code-window">
                    <span class="code-window-region">{{ window.region || 'Unspecified region' }}</span>
                    <span class="code-window-timing">{{ window.timing }}</span>
                    <span class="code-window-dates">{{ window.dateRange }}</span>
                  </div>
                </div>
                <div v-else class="code-window code-window-unverified">
                  <span>Expiry not confirmed</span>
                </div>

                <div v-if="code.rewards.length" class="rewards-list" aria-label="Rewards">
                  <span v-for="reward in code.rewards" :key="reward" class="reward-pill">{{ reward }}</span>
                </div>

                <a
                  v-if="code.source?.url"
                  class="code-source"
                  :href="code.source.url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ code.source.name || 'Primary source' }} ↗
                </a>
                <span v-else class="code-source code-source-unverified">Source unavailable</span>
              </article>
            </div>
            <div v-else class="empty-box codes-empty">
              <span class="empty-icon" aria-hidden="true">✦</span>
              No active redeem codes right now.
            </div>
          </section>

          <section id="news" class="block">
            <div class="section-header">
              <span class="section-tag">05 / Announcements</span>
              <h2 class="section-title">Latest <em>Announcements</em></h2>
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
        <div v-else-if="!error" class="empty-box">
          <span class="empty-icon">✦</span>
          Loading game telemetry...
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
            <a href="#codes">Codes</a>
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
