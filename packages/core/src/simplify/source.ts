import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { parseListings, type ParsedListings } from './schema'

/**
 * Structured JSON that the Simplify repo keeps next to its README.
 * The repo declares no license: each instance downloads it, and Uni never redistributes it.
 */
export const SIMPLIFY_LISTINGS_URL =
  'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json'

/**
 * - cache: the local file is newer than maxAgeMs.
 * - not_modified: GitHub answered 304 (ETag), so the local file is still current.
 * - downloaded: a new version was downloaded.
 * - stale: the download failed and the last good copy is used.
 */
export type SyncStatus = 'cache' | 'not_modified' | 'downloaded' | 'stale'

export interface SyncOptions {
  /** Cache folder. A `simplify/` folder is created inside it. */
  cacheDir: string
  /** Maximum age of the local copy before asking GitHub. */
  maxAgeMs: number
  /** Ignores the age of the local copy ("Sync now"). */
  force?: boolean
  url?: string
  fetchImpl?: typeof fetch
  now?: () => Date
  timeoutMs?: number
}

export interface SyncResult extends ParsedListings {
  status: SyncStatus
  /** Last time the content was confirmed with GitHub. */
  fetchedAt: Date
  /** Why the sync failed, when status is 'stale'. */
  error?: string
}

const metaSchema = z.object({
  url: z.string(),
  etag: z.string().nullable(),
  fetchedAt: z.string(),
})

interface CacheMeta {
  url: string
  etag: string | null
  fetchedAt: Date
}

interface LocalCache {
  meta: CacheMeta
  text: string
}

export async function syncSimplifyListings(options: SyncOptions): Promise<SyncResult> {
  const url = options.url ?? SIMPLIFY_LISTINGS_URL
  const now = options.now ?? (() => new Date())
  const fetchImpl = options.fetchImpl ?? fetch
  const dir = path.join(options.cacheDir, 'simplify')
  const dataPath = path.join(dir, 'listings.json')
  const metaPath = path.join(dir, 'meta.json')

  let cache = await readLocalCache(dataPath, metaPath, url)

  if (cache !== null && options.force !== true) {
    const age = now().getTime() - cache.meta.fetchedAt.getTime()
    if (age >= 0 && age < options.maxAgeMs) {
      const parsed = tryParse(cache.text)
      if (parsed !== null) return { ...parsed, status: 'cache', fetchedAt: cache.meta.fetchedAt }
      cache = null
    }
  }

  const fallback = (error: unknown): SyncResult => {
    const parsed = cache === null ? null : tryParse(cache.text)
    if (cache === null || parsed === null) throw error
    return {
      ...parsed,
      status: 'stale',
      fetchedAt: cache.meta.fetchedAt,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  let response: Response
  try {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (cache?.meta.etag != null) headers['if-none-match'] = cache.meta.etag
    response = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    })
  } catch (error) {
    return fallback(error)
  }

  if (response.status === 304 && cache !== null) {
    const parsed = tryParse(cache.text)
    if (parsed !== null) {
      const fetchedAt = now()
      await writeMeta(metaPath, { url, etag: cache.meta.etag, fetchedAt })
      return { ...parsed, status: 'not_modified', fetchedAt }
    }
  }

  if (!response.ok) {
    return fallback(new Error(`GitHub answered ${response.status} when downloading listings.json`))
  }

  let text: string
  let parsed: ParsedListings
  try {
    text = await response.text()
    // Validate before writing: a bad download never replaces the last good copy.
    parsed = parseListings(JSON.parse(text) as unknown)
  } catch (error) {
    return fallback(error)
  }

  await mkdir(dir, { recursive: true })
  await writeAtomic(dataPath, text)
  const fetchedAt = now()
  await writeMeta(metaPath, { url, etag: response.headers.get('etag'), fetchedAt })
  return { ...parsed, status: 'downloaded', fetchedAt }
}

function tryParse(text: string): ParsedListings | null {
  try {
    return parseListings(JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

async function readLocalCache(
  dataPath: string,
  metaPath: string,
  url: string,
): Promise<LocalCache | null> {
  try {
    const rawMeta = metaSchema.safeParse(JSON.parse(await readFile(metaPath, 'utf8')) as unknown)
    if (!rawMeta.success || rawMeta.data.url !== url) return null
    const fetchedAt = new Date(rawMeta.data.fetchedAt)
    if (Number.isNaN(fetchedAt.getTime())) return null
    const text = await readFile(dataPath, 'utf8')
    return { meta: { url, etag: rawMeta.data.etag, fetchedAt }, text }
  } catch {
    return null
  }
}

async function writeMeta(metaPath: string, meta: CacheMeta): Promise<void> {
  await mkdir(path.dirname(metaPath), { recursive: true })
  const body = JSON.stringify({ ...meta, fetchedAt: meta.fetchedAt.toISOString() }, null, 2)
  await writeAtomic(metaPath, body)
}

async function writeAtomic(filePath: string, contents: string): Promise<void> {
  const tmp = `${filePath}.${process.pid.toString()}.${Date.now().toString()}.tmp`
  await writeFile(tmp, contents, 'utf8')
  await rename(tmp, filePath)
}
