# Active Redeem and Sync Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an active-code section for all configured games and clarify sync freshness/fallback states while preserving Game Hub's celestial theme.

**Architecture:** Extend per-game adapters and manual JSON overrides with a validated `redeemCodes` collection. Automate only where game-specific official sources can be parsed robustly; keep manual-only paths for other games. Preserve prior good data on source failures and expose source freshness to the UI.

**Tech Stack:** Nuxt 3, Vue, Node.js built-ins, JSON feeds, `node --test`.

**Spec:** Finn approved all configured games, per-game sources (not a single shared source), manual supplementation/fallback, active only with confirmed validity, visibly unverified otherwise, display code/rewards/source/expiry where known, clearer sync/empty/failure states, and the existing theme.

## Global Constraints

- Cover IDs `zzz`, `arknights-endfield`, `arknights`, `wuthering-waves`, `nte`.
- Never use one shared redeem-code source as the sole source for all games.
- Do not invent codes or mark uncertain codes active; third-party sources alone cannot validate active status.
- No player UID submission or automated redemption.
- No new dependencies without necessity; preserve responsive/accessibility behavior.
- Preserve prior good automatic data on upstream failure; do not refresh its successful timestamp falsely.
- Source policies/rate limits remain unverified; only use bounded fetching of public pages with demonstrated structure.
- No deployment in scope.

## Review Focus

- Source fetch fails or parsing is malformed: preserve last good records and expose stale status; test this.
- Expiry absent, malformed, past, future, or region-specific: never present incorrectly as active; test each boundary.
- Manual and automatic records collide: merge by normalized code plus region without losing distinct windows; test precedence.
- No automatic source for a game: manual data and empty state still work; verify all five game IDs.
- Narrow viewport/long code: text remains readable and copyable; verify mobile and desktop.

---

### Task 1: Confirm game-specific source decisions

**Files:**
- Review: `.oc/redeem-source-evidence.md`
- Optional notes: `docs/superpowers/specs/2026-11-11-redeem-sources.md`

**Interfaces:** ZZZ and Endfield official news are candidates for bounded text parsing. Manual supplement image/live-only posts, and preserve Endfield regional windows. Arknights and NTE are manual-only on current evidence. Wuthering Waves remains manual-only unless a current official parseable source is demonstrated. Stop and ask Finn if a source decision requires a new access method or changes product behavior.

- [ ] Inspect current raw HTML/JSON response and robots/access notes for each proposed automatic source; verify article body is present without browser-only hydration. If not, use a documented public JSON endpoint or choose manual-only.
- [ ] Record source URL and final automatic/manual-only choice for all five games.
- [ ] If no viable source, leave automatic fetch disabled for that game.

### Task 2: Define schema and adapter outputs

**Files:**
- Modify: `app/shared/feed-schema.js`
- Modify: all five `scripts/games/<game-id>.js`
- Modify: `tests/feed-schema.test.js`, `tests/game-adapters.test.js`, focused parser tests

**Interfaces:** Each record: `{ code: string, rewards: string[], source: { name: string, url: string }, verifiedAt?: ISODateTime, windows?: Array<{ region: string, startsAt?: ISODateTime, expiresAt?: ISODateTime }> }`. Do not persist a display `status`; derive it from each region window at read/render time: active only when both boundaries exist and `startsAt <= now < expiresAt`, upcoming when `now < startsAt`, expired when `now >= expiresAt` (exclude from active UI), and unverified when either boundary is absent or source validity is otherwise uncertain. If a record has windows and all are expired, drop the record; never convert it to an unverified dateless record. `redeemCodes` defaults to `[]` for older feed JSON, and all five adapters return it explicitly.

- [ ] Add tests for defaults, malformed records, regional windows, and parser empty/failure behavior.
- [ ] Implement schema and adapter outputs together; do not leave feeds invalid between commits.
- [ ] Implement only confirmed source parsers and distinguish source failure from successful empty results.
- [ ] Run `npm test`; all tests pass.

### Task 3: Merge safely, persist source status, and prune API data

**Files:**
- Modify: `scripts/sync.js`
- Modify: `app/server/api/feed.get.js`
- Modify: `tests/sync-prune.test.js`, `tests/feed-api.test.js`, focused sync tests

**Interfaces:** Normalize keys as `code.trim().toUpperCase()` and `region.trim().toLowerCase()`. Merge per `(normalizedCode, normalizedRegion)` window, so a manual override changes only its matching region and cannot remove other regions. Keep automatic and manual records separate until merging the response; on source failure, recover only automatic records from the previous feed (excluding entries with manual provenance), then reapply the current manual file so removed manual entries do not persist. Represent upstream result as an explicit discriminated state: `{ ok: true, codes: [...] }` including successful-empty, or `{ ok: false, error }`; adapters must not convert exceptions/parse failures into empty success. Feed metadata is `redeemSync: { mode: 'automatic' | 'manual-only', status: 'ok' | 'stale' | 'not-configured', lastSuccessAt: ISODateTime | null }`. On failure, preserve previous good automatic records, merge manual overrides, set `status: 'stale'`, and keep prior `lastSuccessAt`; on successful empty result, replace prior automatic codes and update `lastSuccessAt`. Manual-only feeds use `mode: 'manual-only'`, `status: 'not-configured'`, and `lastSuccessAt: null`, not failed/stale. API prunes expired windows between scheduled syncs and derives active/upcoming/unverified status using the fixed time-bound rules in Task 2.

- [ ] Test precedence, regional duplicates, failed-source preservation, successful-empty replacement, expiry pruning, and upcoming status.
- [ ] Implement safe merging, failure status and API pruning.
- [ ] Run `npm test`; all tests pass.

### Task 4: Render redeem codes and sync/empty states

**Files:**
- Modify: `app/pages/index.vue`
- Modify: `app/assets/css/main.css`
- Modify tests if feasible in existing setup

**Interfaces:** Redeem section for selected game shows code, rewards, source, expiry if present, and active/upcoming/unverified label derived from time windows. Show `redeemSync.lastSuccessAt` and distinguish `ok`, `stale`, and `not-configured` (manual-only) from empty codes and API-load failure. Add nav link. Browser page load does not imply upstream fetch. Use accessible text/controls, retain theme and mobile layout.

- [ ] Test or otherwise verify code states, stale/error and empty states, and copy affordance.
- [ ] Implement responsive styles; ensure long text wraps without clipping.
- [ ] Run `npm test` and `npm run build`; both pass.
- [ ] Exercise mobile and desktop layouts with empty and unverified entries.

### Task 5: Integrate, verify and review

**Files:** all task-scoped files above.

- [ ] Run complete tests and production build.
- [ ] Inspect full diff for provenance, secrets, accessibility, responsive behavior, and unrelated changes.
- [ ] Confirm source decision for all five games.
- [ ] Recheck every active code against primary-source validity and exact expiry/region window.
- [ ] Deploy only after separate user authorization.
