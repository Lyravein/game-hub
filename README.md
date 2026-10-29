# Game Hub

Multi-game dashboard and feed aggregator built with Nuxt 3. Displays active events, news, versions, and banner schedules across selected games:

- Zenless Zone Zero (ZZZ)
- Arknights: Endfield
- Arknights (Global)
- Wuthering Waves
- Neverness to Everness (NTE)

Live site: [https://lyravein.my.id/game-hub/](https://lyravein.my.id/game-hub/)

## Features

- **Centralized Game Roster**: Configured via `games.config.js`.
- **Feed Normalization**: Strict schema validation (`app/shared/feed-schema.js`) for events, news, banners, and version metadata.
- **Ongoing & Upcoming Phase Tracking**: Banners and events are automatically categorized into ongoing and upcoming groups with live countdown badges.
- **Auto-Prune & Rollover**: Expired banners and events are automatically purged during sync, version numbers roll over on release, and the server API filters stale entries in real time.
- **Dedicated Artwork & Local Assets**: Official banner and event art stored locally under `app/public/art/` alongside a secured image proxy for upstream game CDNs.
- **Manual Overrides**: Support for curated overrides and future schedules via `data/manual/<game-id>.json`.
- **Cosmic UI**: Lightweight dark moonlit theme matching `lyravein.my.id` design tokens, starry background, and mobile-responsive navigation.

## Tech Stack

- **Framework**: Nuxt 3 (SSR with Nitro node-server preset)
- **Styling**: Modern CSS tokens, Outfit typeface, and backdrop blur
- **Testing**: Node.js built-in test runner (`node --test`)
- **Automation**: Systemd timer executing daily sync at 03:00 WIB (Asia/Jakarta)

## Project Structure

```
├── app/
│   ├── assets/css/        # Global stylesheets and cosmic design tokens
│   ├── composables/       # Time formatting and reactive countdown utilities
│   ├── layouts/           # Default layout wrapper
│   ├── pages/             # Main dashboard view
│   ├── public/art/        # Dedicated game art, banners, and event posters
│   ├── server/api/        # Server API routes (/api/feed, /api/img)
│   └── shared/            # Shared feed validation schema
├── data/
│   ├── <game-id>/         # Synced feed JSON per game
│   └── manual/            # Manual overrides and upcoming schedule data
├── scripts/
│   ├── games/             # Game-specific adapters (crawlers and parsers)
│   └── sync.js            # Sync orchestrator, merger, and pruning engine
├── tests/                 # Unit and regression test suite
├── games.config.js        # Active game roster configuration
└── nuxt.config.ts         # Nuxt application configuration
```

## Getting Started

### Development

```bash
npm install
npm run dev
```

### Run Tests

```bash
npm test
```

### Sync Game Data

```bash
# Sync all games
node scripts/sync.js

# Sync a specific game
node scripts/sync.js zzz
node scripts/sync.js wuthering-waves
node scripts/sync.js arknights
node scripts/sync.js nte
node scripts/sync.js arknights-endfield
```

### Production Build

```bash
npm run build
node .output/server/index.mjs
```

## Deployment & Production Sync

- **Server**: Hosted via systemd user unit `game-hub.service` on port 3000.
- **Daily Cron**: Managed by `game-hub-sync.timer` scheduled for `*-*-* 03:00:00 Asia/Jakarta` with persistence.
- **Routing**: Ingress through Cloudflare Tunnel with apex rewrite configured in `lyravein-web` (Vercel).
