import 'server-only'
import type { FailureCategory, Result, SheetsFailure } from '@uni/core'
import type { z } from 'zod'
import { googleErrorSchema } from '@/lib/sheets/schemas'
import type { AccessTokenProvider } from '@/lib/sheets/token'

export const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/'
const TIMEOUT_MS = 10_000
/** Waits before the second, third and fourth attempts (Requirement 12.6). */
export const RETRY_DELAYS_MS = [1000, 2000, 4000] as const
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1

/**
 * Reason for a 400 whose Google message starts with "Unable to parse range". The gateway uses
 * it to detect a missing tab in `ranges` and fall back to `listTabs`.
 */
export const RANGE_PARSE_REASON = 'unable_to_parse_range'

export interface SheetsRequestOptions {
  method: 'GET' | 'POST'
  /** Path under `https://sheets.googleapis.com/v4/`, e.g. `spreadsheets/{id}:batchUpdate`. */
  path: string
  query?: URLSearchParams
  body?: unknown
  /** Reads retry on 429 and 503; writes retry on 429 only. */
  kind: 'read' | 'write'
}

export type SheetsEndpoint = 'get' | 'batchUpdate' | 'token'

/** The only fields ever logged. No URL query, header, token, key or body (Requirement 2.6). */
export interface SheetsLogEntry {
  category: FailureCategory
  httpStatus: number | null
  reason: string
  method: 'GET' | 'POST'
  endpoint: SheetsEndpoint
}

export type Logger = (entry: SheetsLogEntry) => void

export const consoleLogger: Logger = (entry) => {
  console.warn('[sheets] request failed', entry)
}

export interface SheetsRequestDeps {
  token: AccessTokenProvider
  fetch: typeof fetch
  sleep: (ms: number) => Promise<void>
  log: Logger
}

export const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const isTimeout = (e: unknown): boolean => e instanceof Error && e.name === 'TimeoutError'

// Google's `error.status` is an enum such as PERMISSION_DENIED. Anything else is not logged.
const GOOGLE_STATUS = /^[A-Z_]{1,64}$/

/** Reads Google's reason from an error body, falling back to `http_<status>`. */
async function readGoogleError(res: Response): Promise<{ reason: string; message: string }> {
  const body: unknown = await res.json().catch(() => undefined)
  const parsed = googleErrorSchema.safeParse(body)
  const status = parsed.success ? parsed.data.error.status : undefined
  return {
    reason: status !== undefined && GOOGLE_STATUS.test(status) ? status : `http_${res.status}`,
    message: parsed.success ? (parsed.data.error.message ?? '') : '',
  }
}

function classifyStatus(status: number): FailureCategory {
  if (status === 401 || status === 403) return 'permission_denied'
  if (status === 404) return 'not_found'
  if (status === 429) return 'rate_limited'
  if (status >= 400 && status < 500) return 'invalid_sheet'
  return 'network'
}

const isRetryable = (status: number, kind: SheetsRequestOptions['kind']): boolean =>
  status === 429 || (status === 503 && kind === 'read')

/**
 * Calls the Sheets REST API with a 10 s timeout per attempt, retries 429 (and 503 on reads)
 * after 1, 2 and 4 s, validates the body with `schema`, and classifies every failure into one
 * category (Requirements 2.4, 2.8, 8.12, 12.6, 12.7, 12.9). Each failure is logged once.
 */
export async function sheetsRequest<T>(
  opts: SheetsRequestOptions,
  schema: z.ZodType<T>,
  deps: SheetsRequestDeps,
): Promise<Result<T, SheetsFailure>> {
  const endpoint: SheetsEndpoint = opts.path.endsWith(':batchUpdate') ? 'batchUpdate' : 'get'

  const fail = (
    category: FailureCategory,
    httpStatus: number | null,
    reason: string,
    logEndpoint: SheetsEndpoint = endpoint,
    method: 'GET' | 'POST' = opts.method,
  ): { ok: false; error: SheetsFailure } => {
    deps.log({ category, httpStatus, reason, method, endpoint: logEndpoint })
    return { ok: false, error: { category, httpStatus, reason } }
  }

  const token = await deps.token.getToken()
  if (!token.ok) {
    const { category, httpStatus, reason } = token.error
    return fail(category, httpStatus, reason, 'token', 'POST')
  }

  const url = new URL(opts.path, SHEETS_API_BASE)
  if (opts.query) url.search = opts.query.toString()
  const headers: Record<string, string> = { authorization: `Bearer ${token.value}` }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const body = opts.body === undefined ? undefined : JSON.stringify(opts.body)

  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await deps.fetch(url, {
        method: opts.method,
        headers,
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (e) {
      return fail('network', null, isTimeout(e) ? 'timeout' : 'connection_error')
    }

    if (res.ok) {
      let json: unknown
      try {
        json = await res.json()
      } catch (e) {
        if (isTimeout(e)) return fail('network', null, 'timeout')
        return fail('invalid_sheet', res.status, 'unexpected_response')
      }
      const parsed = schema.safeParse(json)
      if (!parsed.success) return fail('invalid_sheet', res.status, 'unexpected_response')
      return { ok: true, value: parsed.data }
    }

    const delay = RETRY_DELAYS_MS[attempt]
    if (isRetryable(res.status, opts.kind) && attempt + 1 < MAX_ATTEMPTS && delay !== undefined) {
      await res.body?.cancel().catch(() => undefined)
      await deps.sleep(delay)
      continue
    }

    const category = classifyStatus(res.status)
    const google = await readGoogleError(res)
    if (category === 'invalid_sheet') {
      const reason = google.message.startsWith('Unable to parse range')
        ? RANGE_PARSE_REASON
        : 'bad_request'
      return fail(category, res.status, reason)
    }
    return fail(category, res.status, google.reason)
  }
}
