import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFeed } from '../app/shared/feed-schema.js';

const valid = {
  gameId: 'genshin', gameName: 'Genshin Impact', version: {},
  banners: [{ type: 'character', name: 'X', image: '', startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-21T00:00:00Z' }],
  events: [{ name: 'E', startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-21T00:00:00Z', rewards: ['Primogem x420'] }],
  news: [{ title: 'T', url: 'https://x', publishedAt: '2026-10-18T00:00:00Z', category: 'announcement' }],
  syncedAt: '2026-10-18T00:00:00Z',
};

test('valid feed passes', () => {
  assert.deepEqual(validateFeed(valid), { ok: true, errors: [] });
});
test('banner without type fails', () => {
  const bad = structuredClone(valid); bad.banners[0] = { ...bad.banners[0], type: undefined, name: undefined };
  assert.equal(validateFeed(bad).ok, false);
});
test('missing arrays fail', () => {
  const bad = { ...valid }; delete bad.events;
  assert.equal(validateFeed(bad).ok, false);
});
test('bad timestamp fails', () => {
  const bad = structuredClone(valid); bad.news[0].publishedAt = 'not-a-date';
  assert.equal(validateFeed(bad).ok, false);
});
