<script setup>
const games = [
  { id: 'genshin', name: 'Genshin Impact' },
  { id: 'hsr', name: 'Honkai: Star Rail' },
  { id: 'zzz', name: 'Zenless Zone Zero' },
  { id: 'arknights', name: 'Arknights' },
]
const { data, error } = await useFetch('/api/feed')
const active = useState('active-game', () => games[0]?.id)
const feed = computed(() => data.value?.games?.find(g => g.gameId === active.value))
const countdown = useCountdown()
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
              v-for="g in games"
              :key="g.id"
              :class="{ active: g.id === active }"
              @click="active = g.id"
            >{{ g.name }}</button>
          </div>
        </section>

        <template v-if="feed">
          <section class="block">
            <h2>Next Version</h2>
            <div v-if="feed.version?.next?.startsAt" class="next-version">
              <span class="ver">{{ feed.version.current || '' }} → {{ feed.version.next.number }}</span>
              <span class="when">{{ fmtDate(feed.version.next.startsAt) }}</span>
              <span class="countdown">{{ countdown(feed.version.next.startsAt) }}</span>
            </div>
            <p v-else class="empty">Next version date not set yet.</p>
          </section>

          <section class="block">
            <h2>Active Banners</h2>
            <div v-if="feed.banners.length" class="grid">
              <div v-for="b in feed.banners" :key="b.name + b.startsAt" class="card">
                <h3><span class="tag" :class="b.type">{{ b.type }}</span>{{ b.name }}</h3>
                <div class="meta">{{ fmtDate(b.startsAt) }} → {{ fmtDate(b.endsAt) }}</div>
                <div class="meta countdown">{{ countdown(b.endsAt) }}</div>
              </div>
            </div>
            <p v-else class="empty">No banner data yet.</p>
          </section>

          <section class="block">
            <h2>Ongoing Events</h2>
            <div v-if="feed.events.length" class="grid">
              <div v-for="e in feed.events" :key="e.name + e.startsAt" class="card">
                <h3>{{ e.name }}</h3>
                <div class="meta">{{ fmtDate(e.startsAt) }} → {{ fmtDate(e.endsAt) }}</div>
                <div class="meta countdown">{{ countdown(e.endsAt) }}</div>
                <div v-if="e.rewards?.length" class="chips">
                  <span v-for="r in e.rewards" :key="r" class="reward">{{ r }}</span>
                </div>
                <a v-if="e.url" :href="e.url" target="_blank" rel="noopener">Details ↗</a>
              </div>
            </div>
            <p v-else class="empty">No event data yet.</p>
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
                class="card"
                style="display:block"
              >
                <h3>{{ n.title }}</h3>
                <div class="meta">{{ fmtDate(n.publishedAt) }}</div>
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
