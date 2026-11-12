import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rawListing } from '../test/fixtures'
import { syncSimplifyListings, type SyncOptions } from './source'

const HOUR = 60 * 60 * 1000
const LISTINGS_URL = 'https://example.test/listings.json'

let cacheDir: string
let clock: Date

beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(tmpdir(), 'uni-simplify-'))
  clock = new Date('2026-11-11T12:00:00Z')
})

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true })
})

function jsonResponse(body: unknown, etag = '"v1"'): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { etag } })
}

function sync(fetchImpl: typeof fetch, extra: Partial<SyncOptions> = {}) {
  return syncSimplifyListings({
    cacheDir,
    maxAgeMs: 24 * HOUR,
    url: LISTINGS_URL,
    fetchImpl,
    now: () => clock,
    ...extra,
  })
}

describe('syncSimplifyListings', () => {
  it('descarga, valida y guarda la copia local', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse([rawListing()])))
    const result = await sync(fetchImpl)

    expect(result.status).toBe('downloaded')
    expect(result.jobs).toHaveLength(1)
    const meta = JSON.parse(
      await readFile(path.join(cacheDir, 'simplify/meta.json'), 'utf8'),
    ) as unknown
    expect(meta).toMatchObject({ url: LISTINGS_URL, etag: '"v1"', fetchedAt: clock.toISOString() })
  })

  it('usa la copia local sin red mientras sea reciente', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse([rawListing()])))
    await sync(fetchImpl)
    clock = new Date(clock.getTime() + HOUR)

    const result = await sync(fetchImpl)
    expect(result.status).toBe('cache')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('consulta con ETag cuando la copia expira y acepta 304', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([rawListing()]))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
    await sync(fetchImpl)
    clock = new Date(clock.getTime() + 25 * HOUR)

    const result = await sync(fetchImpl)
    expect(result.status).toBe('not_modified')
    expect(result.fetchedAt).toEqual(clock)
    const headers = fetchImpl.mock.calls[1]?.[1]?.headers as Record<string, string>
    expect(headers['if-none-match']).toBe('"v1"')
  })

  it('force ignora la edad de la copia local', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([rawListing()]))
      .mockResolvedValueOnce(jsonResponse([rawListing(), rawListing({ id: 'nuevo' })], '"v2"'))
    await sync(fetchImpl)

    const result = await sync(fetchImpl, { force: true })
    expect(result.status).toBe('downloaded')
    expect(result.jobs).toHaveLength(2)
  })

  it('si falla la red usa la última copia buena', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([rawListing()]))
      .mockRejectedValueOnce(new Error('sin conexión'))
    await sync(fetchImpl)

    const result = await sync(fetchImpl, { force: true })
    expect(result).toMatchObject({ status: 'stale', error: 'sin conexión' })
    expect(result.jobs).toHaveLength(1)
  })

  it('una descarga con formato inválido no reemplaza la copia buena', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([rawListing()]))
      .mockResolvedValueOnce(jsonResponse({ cambio: 'de formato' }, '"v2"'))
    await sync(fetchImpl)

    const result = await sync(fetchImpl, { force: true })
    expect(result.status).toBe('stale')
    const saved = JSON.parse(
      await readFile(path.join(cacheDir, 'simplify/listings.json'), 'utf8'),
    ) as unknown
    expect(saved).toHaveLength(1)
  })

  it('devuelve stale ante un error HTTP con copia local', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([rawListing()]))
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
    await sync(fetchImpl)

    const result = await sync(fetchImpl, { force: true })
    expect(result.status).toBe('stale')
    expect(result.error).toContain('429')
  })

  it('lanza el error si no hay copia local', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('sin conexión'))
    await expect(sync(fetchImpl)).rejects.toThrow('sin conexión')
  })

  it('ignora una copia local corrupta y vuelve a descargar', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse([rawListing()])))
    await sync(fetchImpl)
    await writeFile(path.join(cacheDir, 'simplify/listings.json'), '{roto', 'utf8')

    const result = await sync(fetchImpl)
    expect(result.status).toBe('downloaded')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
