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
  if (obj.redeemCodes !== undefined) {
    if (!Array.isArray(obj.redeemCodes)) {
      errors.push('redeemCodes must be an array');
    } else {
      obj.redeemCodes.forEach((code, i) => {
        if (!code || typeof code !== 'object' || Array.isArray(code)) {
          errors.push(`redeemCodes[${i}] must be an object`);
          return;
        }
        if (typeof code.code !== 'string' || !code.code.trim()) errors.push(`redeemCodes[${i}].code missing`);
        if (!Array.isArray(code.rewards) || code.rewards.some(reward => typeof reward !== 'string')) {
          errors.push(`redeemCodes[${i}].rewards must be an array of strings`);
        }
        if (!code.source || typeof code.source !== 'object' || Array.isArray(code.source)) {
          errors.push(`redeemCodes[${i}].source must be an object`);
        } else {
          if (typeof code.source.name !== 'string' || !code.source.name.trim()) errors.push(`redeemCodes[${i}].source.name missing`);
          if (typeof code.source.url !== 'string' || !code.source.url.trim()) errors.push(`redeemCodes[${i}].source.url missing`);
        }
        if (code.verifiedAt !== undefined && !tsOk(code.verifiedAt)) errors.push(`redeemCodes[${i}].verifiedAt invalid`);
        if (code.windows !== undefined) {
          if (!Array.isArray(code.windows)) {
            errors.push(`redeemCodes[${i}].windows must be an array`);
          } else {
            code.windows.forEach((window, j) => {
              if (!window || typeof window !== 'object' || Array.isArray(window)) {
                errors.push(`redeemCodes[${i}].windows[${j}] must be an object`);
                return;
              }
              if (typeof window.region !== 'string' || !window.region.trim()) errors.push(`redeemCodes[${i}].windows[${j}].region missing`);
              if (window.startsAt !== undefined && !tsOk(window.startsAt)) errors.push(`redeemCodes[${i}].windows[${j}].startsAt invalid`);
              if (window.expiresAt !== undefined && !tsOk(window.expiresAt)) errors.push(`redeemCodes[${i}].windows[${j}].expiresAt invalid`);
            });
          }
        }
      });
    }
  }
  if (!tsOk(obj.syncedAt)) errors.push('syncedAt invalid');
  if (obj.version !== undefined && typeof obj.version !== 'object') errors.push('version must be an object');
  return { ok: errors.length === 0, errors };
}
