# Game Hub Option A (5-Day TTL & Vision AI Pipeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use opencode-roles or superpowers:subagent-driven-development to implement this plan PHASE BY PHASE. Each phase must be committed, reviewed, and verified independently before the next phase begins. Do not combine phases into one worker run.

**Goal:** Implement automatic 5-day news/event TTL pruning and an on-demand Vision AI pipeline to parse announcement images into structured banner/event cards without manual JSON editing.

**Architecture:** 
1. Strict 5-day TTL pruning in `scripts/sync.js` and `app/server/api/feed.get.js`.
2. Dedicated OpenAI-compatible Vision AI parser in `scripts/lib/vision-parser.js` with SHA-256 persistent disk cache.
3. Hooking the vision parser into the sync pipeline so announcement images automatically generate feed cards.
4. UI refinement: clear visual indicators for AI-parsed / vision-extracted cards and sync freshness.

**Tech Stack:** Nuxt 3, Node.js built-ins (`fetch`, `crypto`), `node --test`.

## Global Constraints
- Never commit API keys or endpoints to git; read from environment variables (`VISION_API_BASE`, `VISION_API_KEY`, `VISION_MODEL`).
- Preserve existing celestial editorial styling and mobile layout tokens (`#070b12`, `#101a28`, `#9fc6f2`).
- Safe fallback: if Vision API call fails or is unconfigured, sync proceeds normally without throwing.
- Deduplication: never call Vision API twice for the same image URL.
- One phase per worker run. Never combine phases.

---

### Phase 1: 5-Day News & Stale Item TTL Pruning (No External API Dependency)

**Files:**
- Modify: `scripts/sync.js`
- Modify: `app/server/api/feed.get.js`
- Test: `tests/ttl-prune.test.js`

**Deliverable:**
- `FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000`.
- In `scripts/sync.js` and `app/server/api/feed.get.js`, filter out news where `now - Date.parse(item.publishedAt) > FIVE_DAYS_MS`.
- Drop ended events and expired banner windows.
- Full unit test coverage in `tests/ttl-prune.test.js`.

**Verification:**
- `node --test tests/ttl-prune.test.js` PASS.
- `npm test` PASS.

---

### Phase 2: Standalone Vision AI Client & SHA-256 Image Cache

**Files:**
- Create: `scripts/lib/vision-parser.js`
- Test: `tests/vision-parser.test.js`

**Deliverable:**
- Standalone function `extractCardFromImage({ imageUrl, gameId, fetchImpl = fetch })`.
- Reads `VISION_API_BASE`, `VISION_API_KEY`, `VISION_MODEL` from `process.env`.
- If credentials missing, returns `{ ok: false, reason: 'unconfigured' }` gracefully.
- Computes SHA-256 hash of image URL and caches parsed results in `data/.cache/vision-cache.json`.
- Unit tests mock HTTP completion responses and verify schema validation + cache hits.

**Verification:**
- `node --test tests/vision-parser.test.js` PASS.
- `npm test` PASS.

---

### Phase 3: Sync Pipeline Hook & Feed Auto-Generation

**Files:**
- Modify: `scripts/sync.js`
- Test: `tests/sync-vision-integration.test.js`

**Deliverable:**
- In `scripts/sync.js`, when a news announcement has a key promo image and Vision is enabled:
  - Query `extractCardFromImage`.
  - Merge discovered banners and events into `feed.banners` and `feed.events` with `source: 'vision-extracted'`.
- If Vision fails or is not enabled, skip cleanly with zero disruption to regular news sync.

**Verification:**
- `node --test tests/sync-vision-integration.test.js` PASS.
- `npm test` PASS.

---

### Phase 4: UI Freshness & Vision Extraction Badges

**Files:**
- Modify: `app/pages/index.vue`
- Modify: `app/assets/css/main.css`

**Deliverable:**
- If a banner or event has `source: 'vision-extracted'`, display a subtle celestial badge (e.g. `Auto-Detected` / `AI Radar`).
- Mobile-responsive adjustments and verification against `npm run build`.

**Verification:**
- `npm test && npm run build` PASS.
