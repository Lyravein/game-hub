// Single data contract for every game feed.
export function validateFeed(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['feed must be an object'] };
  if (typeof obj.gameId !== 'string' || !obj.gameId) errors.push('gameId must be a non-empty string');
  const tsOk = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
  for (const key of ['banners', 'events', 'news']) {
    if (!Array.isArray(obj[key])) errors.push(`${key} must be an array`);
  }
  if (Array.isArray(obj.banners)) {
    obj.banners.forEach((b, i) => {
      if (typeof b.type !== 'string' || !b.type) errors.push(`banners[${i}].type missing`);
      if (typeof b.name !== 'string' || !b.name) errors.push(`banners[${i}].name missing`);
      if (!tsOk(b.startsAt)) errors.push(`banners[${i}].startsAt invalid`);
      if (!tsOk(b.endsAt)) errors.push(`banners[${i}].endsAt invalid`);
    });
  }
  if (Array.isArray(obj.events)) {
    obj.events.forEach((e, i) => {
      if (typeof e.name !== 'string' || !e.name) errors.push(`events[${i}].name missing`);
      if (!tsOk(e.startsAt)) errors.push(`events[${i}].startsAt invalid`);
      if (!tsOk(e.endsAt)) errors.push(`events[${i}].endsAt invalid`);
      if (e.rewards !== undefined && !Array.isArray(e.rewards)) errors.push(`events[${i}].rewards must be an array`);
    });
  }
  if (Array.isArray(obj.news)) {
    obj.news.forEach((n, i) => {
      if (typeof n.title !== 'string' || !n.title) errors.push(`news[${i}].title missing`);
      if (!tsOk(n.publishedAt)) errors.push(`news[${i}].publishedAt invalid`);
    });
  }
  if (!tsOk(obj.syncedAt)) errors.push('syncedAt invalid');
  if (obj.version !== undefined && typeof obj.version !== 'object') errors.push('version must be an object');
  return { ok: errors.length === 0, errors };
}
