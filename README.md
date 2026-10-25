# Game Hub

Multi-game dashboard and feed aggregator built with Nuxt 3. Displays active events, news, versions, and banner schedules across selected games:

- Zenless Zone Zero (ZZZ)
- Arknights: Endfield
- Arknights
- Wuthering Waves
- Neverness to Everness (NTE)

Live site: [https://lyravein.my.id/game-hub/](https://lyravein.my.id/game-hub/)

## Features

- **Centralized Game Roster**: Configured via `games.config.js`.
- **Feed Normalization**: Strict schema validation (`app/shared/feed-schema.js`) for events, news, banners, and version metadata.
- **Automated Sync**: CLI sync script (`scripts/sync.js`) that fetches and generates static JSON feeds in `data/`.
- **Manual Overrides**: Optional manual overrides via `data/manual/<game-id>.json`.
- **Cosmic UI**: Lightweight interface inspired by the `lyravein.my.id` design tokens.

## Tech Stack

- **Framework**: Nuxt 3 (SSR / Node server preset via Nitro)
- **Styling**: Vanilla CSS with custom properties and Outfit font
- **Testing**: Node.js built-in test runner (`node --test`)

## Project Structure

```
├── app/
│   ├── assets/css/        # Global stylesheets and design tokens
│   ├── composables/       # Time formatting and reactive utilities
│   ├── layouts/           # Default layout wrapper
│   ├── pages/             # Main dashboard view
│   ├── server/api/        # Server API routes (/api/feed)
│   └── shared/            # Shared feed validation schema
├── data/                  # Cached feed JSON per game and manual overrides
├── scripts/               # Data sync scripts and game adapters
├── tests/                 # Unit and regression tests
├── games.config.js        # Active game roster configuration
└── nuxt.config.ts         # Nuxt application configuration
```
