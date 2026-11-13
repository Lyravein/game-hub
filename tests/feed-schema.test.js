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

const validRedeemCodes = [{
  code: 'ENDFIELDSTEAM',
  rewards: ['Chromite x500'],
  source: { name: 'Official News', url: 'https://example.com/redeem' },
  verifiedAt: '2026-11-11T00:00:00Z',
  windows: [
    { region: 'Asia', startsAt: '2026-11-11T00:00:00Z', expiresAt: '2026-11-18T00:00:00Z' },
    { region: 'Americas-Europe', startsAt: '2026-11-11T00:00:00Z', expiresAt: '2026-11-18T00:00:00Z' },
  ],
}];

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
test('valid redeem codes and regional windows pass', () => {
  const feed = { ...valid, redeemCodes: validRedeemCodes };
  assert.deepEqual(validateFeed(feed), { ok: true, errors: [] });
});
test('missing optional redeem codes pass', () => {
  const feed = structuredClone(valid);
  assert.equal('redeemCodes' in feed, false);
  assert.equal(validateFeed(feed).ok, true);
});
test('empty redeem code fails', () => {
  const feed = { ...valid, redeemCodes: [{ ...validRedeemCodes[0], code: '' }] };
  assert.equal(validateFeed(feed).ok, false);
});
test('invalid redeem rewards fail', () => {
  const notArray = { ...valid, redeemCodes: [{ ...validRedeemCodes[0], rewards: 'Chromite x500' }] };
  const nonString = { ...valid, redeemCodes: [{ ...validRedeemCodes[0], rewards: ['Chromite x500', 500] }] };
  assert.equal(validateFeed(notArray).ok, false);
  assert.equal(validateFeed(nonString).ok, false);
});
test('invalid redeem window timestamps fail', () => {
  for (const key of ['startsAt', 'expiresAt']) {
    const code = structuredClone(validRedeemCodes[0]);
    code.windows[0][key] = 'not-a-date';
    assert.equal(validateFeed({ ...valid, redeemCodes: [code] }).ok, false);
  }
});
test('regional redeem windows require a region', () => {
  const code = structuredClone(validRedeemCodes[0]);
  code.windows[0].region = '';
  assert.equal(validateFeed({ ...valid, redeemCodes: [code] }).ok, false);
});
