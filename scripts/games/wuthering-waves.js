// ponytail: no verified public feed source; keep the contract valid until one is confirmed.
export async function buildFeed({ game }) {
  return {
    gameId: game.id, gameName: game.name, version: {},
    banners: [], events: [], news: [],
    syncedAt: new Date().toISOString(),
  }
}
