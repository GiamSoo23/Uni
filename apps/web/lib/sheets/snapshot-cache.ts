import 'server-only'
import {
  parseApplicationsTab,
  parseCompaniesTab,
  type Result,
  type SheetsEnvProblem,
  type SheetsFailure,
  type SheetsGateway,
  type SheetSnapshot,
} from '@uni/core'

/** How long a successful read is served without calling the Sheets API (12.1). */
export const CACHE_TTL_MS = 60_000

export type SheetState =
  | { mode: 'disabled'; problems: SheetsEnvProblem[] }
  | {
      mode: 'enabled'
      /** The last successful snapshot, or null when there is none. */
      snapshot: SheetSnapshot | null
      /** Completion time of the read behind `snapshot`. */
      readAt: Date | null
      /** The failure of this render's read; null when `snapshot` is fresh. */
      failure: SheetsFailure | null
      /** Shown with `permission_denied` so the owner knows whom to share the Sheet with (2.5). */
      clientEmail: string
    }

export type SnapshotCacheOptions =
  | { mode: 'disabled'; problems: SheetsEnvProblem[] }
  | {
      mode: 'enabled'
      gateway: Pick<SheetsGateway, 'readSnapshot'>
      applicationsTab: string
      clientEmail: string
      /** Milliseconds since the epoch, like `Date.now`. */
      now?: () => number
    }

export interface SnapshotCache {
  getSheetState(): Promise<SheetState>
  clearSheetCache(): void
}

type ReadResult = Result<{ snapshot: SheetSnapshot; readAt: number }, SheetsFailure>

/**
 * The Sheet_Cache: the last successful snapshot and its read time, served for 60 s (12.1, 12.2).
 * Concurrent callers share one in-flight read (12.3). Only a success replaces the cache (2.9,
 * 12.10). `clearSheetCache` drops the cache and detaches any in-flight read, and a generation
 * counter keeps a read that started before the clear from storing its result (12.4).
 */
export function createSnapshotCache(opts: SnapshotCacheOptions): SnapshotCache {
  if (opts.mode === 'disabled') {
    const state: SheetState = { mode: 'disabled', problems: opts.problems }
    return { getSheetState: () => Promise.resolve(state), clearSheetCache: () => {} }
  }

  const { gateway, applicationsTab, clientEmail } = opts
  const now = opts.now ?? Date.now
  let cached: { snapshot: SheetSnapshot; readAt: number } | undefined
  let inFlight: Promise<ReadResult> | undefined
  let generation = 0

  const enabled = (failure: SheetsFailure | null): SheetState => ({
    mode: 'enabled',
    snapshot: cached?.snapshot ?? null,
    readAt: cached === undefined ? null : new Date(cached.readAt),
    failure,
    clientEmail,
  })

  async function read(): Promise<ReadResult> {
    const res = await gateway.readSnapshot(applicationsTab)
    if (!res.ok) return res
    const applications = parseApplicationsTab(res.value.applications)
    if (!applications.ok) return applications
    const companies = parseCompaniesTab(res.value.companies)
    return {
      ok: true,
      value: {
        snapshot: {
          applications: applications.value.rows,
          overrides: companies.overrides,
          issues: [...applications.value.issues, ...companies.issues],
        },
        readAt: now(),
      },
    }
  }

  function startRead(): Promise<ReadResult> {
    const started = generation
    const promise = read()
      .catch((): ReadResult => ({
        ok: false,
        error: { category: 'network', httpStatus: null, reason: 'unexpected_error' },
      }))
      .then((result) => {
        if (result.ok && started === generation) cached = result.value
        return result
      })
      .finally(() => {
        if (inFlight === promise) inFlight = undefined
      })
    return promise
  }

  return {
    async getSheetState() {
      if (cached !== undefined && now() - cached.readAt < CACHE_TTL_MS) return enabled(null)
      inFlight ??= startRead()
      const result = await inFlight
      if (!result.ok) return enabled(result.error)
      // A read that finished after a clear is returned to its callers but not cached.
      return {
        mode: 'enabled',
        snapshot: result.value.snapshot,
        readAt: new Date(result.value.readAt),
        failure: null,
        clientEmail,
      }
    },
    clearSheetCache() {
      generation += 1
      cached = undefined
      inFlight = undefined
    },
  }
}
