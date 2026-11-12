import 'server-only'
import path from 'node:path'
import { syncSimplifyListings, type SyncResult } from '@uni/core'

const HOUR_MS = 60 * 60 * 1000
/** After a network failure, how long to wait before retrying on each visit. */
const STALE_RETRY_MS = 10 * 60 * 1000

function readMaxAgeMs(): number {
  const hours = Number(process.env.UNI_SYNC_MAX_AGE_HOURS ?? '168')
  return Number.isFinite(hours) && hours > 0 ? hours * HOUR_MS : 168 * HOUR_MS
}

/**
 * On Vercel only `/tmp` is writable, and it's emptied when the instance is
 * recycled: a new instance downloads the data once more.
 */
function defaultCacheDir(): string {
  if (process.env.VERCEL === '1') return '/tmp/uni-cache'
  return path.join(process.cwd(), '.cache')
}

const cacheDir = process.env.UNI_CACHE_DIR ?? defaultCacheDir()
const maxAgeMs = readMaxAgeMs()

let memo: { result: SyncResult; checkedAt: number } | null = null
let inflight: Promise<SyncResult> | null = null

function memoIsFresh(now: number): boolean {
  if (memo === null) return false
  if (memo.result.status === 'stale') return now - memo.checkedAt < STALE_RETRY_MS
  return now - memo.result.fetchedAt.getTime() < maxAgeMs
}

/**
 * Simplify listings. By default they refresh once a week
 * (UNI_SYNC_MAX_AGE_HOURS). `force` is the "Sync now" button.
 * The result is kept in memory so ~13 MB isn't parsed on every visit.
 */
export async function getListings({ force = false } = {}): Promise<SyncResult> {
  if (!force && memoIsFresh(Date.now()) && memo !== null) return memo.result
  if (inflight !== null) return inflight

  inflight = syncSimplifyListings({ cacheDir, maxAgeMs, force })
    .then((result) => {
      memo = { result, checkedAt: Date.now() }
      return result
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export const syncIntervalHours = maxAgeMs / HOUR_MS
