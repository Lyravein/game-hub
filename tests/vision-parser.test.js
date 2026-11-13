import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { rmSync, existsSync } from 'node:fs'
import { extractCardFromImage, computeImageHash, loadVisionCache, saveVisionCache } from '../scripts/lib/vision-parser.js'

test('extractCardFromImage returns unconfigured when env variables are missing', async () => {
  const res = await extractCardFromImage({
    imageUrl: 'https://example.com/art.jpg',
    gameId: 'zzz',
    env: {}
  })
  assert.equal(res.ok, false)
  assert.equal(res.reason, 'unconfigured')
})

test('extractCardFromImage calls OpenAI vision endpoint and returns structured cards', async () => {
  const fakeEnv = {
    VISION_API_BASE: 'https://mock.api/v1',
    VISION_API_KEY: 'test-key',
    VISION_MODEL: 'test-vision-model'
  }

  let capturedUrl = ''
  let capturedBody = null

  const mockFetch = async (url, options) => {
    capturedUrl = url
    capturedBody = JSON.parse(options.body)
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                banners: [
                  {
                    type: 'character',
                    name: 'Gilded Night',
                    featured: ['Lumi'],
                    startsAt: '2026-11-20T04:00:00.000Z',
                    endsAt: '2026-12-10T03:59:00.000Z'
                  }
                ],
                events: []
              })
            }
          }
        ]
      })
    }
  }

  const res = await extractCardFromImage({
    imageUrl: 'https://example.com/banner.png',
    gameId: 'zzz',
    env: fakeEnv,
    fetchImpl: mockFetch
  })

  assert.equal(res.ok, true)
  assert.equal(res.cached, false)
  assert.equal(capturedUrl, 'https://mock.api/v1/chat/completions')
  assert.equal(capturedBody.model, 'test-vision-model')
  assert.equal(res.data.banners.length, 1)
  assert.equal(res.data.banners[0].name, 'Gilded Night')
})

test('extractCardFromImage uses cache and prevents duplicate fetch calls', async () => {
  const cachePath = join(process.cwd(), 'tests/.tmp-vision-cache.json')
  if (existsSync(cachePath)) rmSync(cachePath)

  const fakeEnv = {
    VISION_API_BASE: 'https://mock.api/v1',
    VISION_API_KEY: 'test-key',
    VISION_MODEL: 'test-vision-model'
  }

  let fetchCallCount = 0
  const mockFetch = async () => {
    fetchCallCount++
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                banners: [],
                events: [{ name: 'Trial Event', rewards: ['Polychrome x300'] }]
              })
            }
          }
        ]
      })
    }
  }

  const res1 = await extractCardFromImage({
    imageUrl: 'https://example.com/event.jpg',
    gameId: 'zzz',
    env: fakeEnv,
    fetchImpl: mockFetch,
    cachePath
  })

  assert.equal(res1.ok, true)
  assert.equal(res1.cached, false)
  assert.equal(fetchCallCount, 1)

  const res2 = await extractCardFromImage({
    imageUrl: 'https://example.com/event.jpg',
    gameId: 'zzz',
    env: fakeEnv,
    fetchImpl: mockFetch,
    cachePath
  })

  assert.equal(res2.ok, true)
  assert.equal(res2.cached, true)
  assert.equal(fetchCallCount, 1) // Did not call fetch again!
  assert.equal(res2.data.events[0].name, 'Trial Event')

  if (existsSync(cachePath)) rmSync(cachePath)
})
