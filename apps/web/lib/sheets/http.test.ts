import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  RANGE_PARSE_REASON,
  sheetsRequest,
  type SheetsLogEntry,
  type SheetsRequestOptions,
} from '@/lib/sheets/http'
import type { AccessTokenProvider } from '@/lib/sheets/token'

// Google is never called: `fetch`, `sleep` and the token provider are injected.
const TOKEN = 'ya29.test-token'
const schema = z.object({ spreadsheetId: z.string() })

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const googleError = (code: number, status: string, message = '') =>
  json(code, { error: { code, status, message } })

const READ: SheetsRequestOptions = {
  method: 'GET',
  path: 'spreadsheets/sheet-123',
  query: new URLSearchParams({ fields: 'spreadsheetId' }),
  kind: 'read',
}
const WRITE: SheetsRequestOptions = {
  method: 'POST',
  path: 'spreadsheets/sheet-123:batchUpdate',
  body: { requests: [] },
  kind: 'write',
}

function setup(responses: (Response | Error)[], token?: AccessTokenProvider) {
  const fetchMock = vi.fn<typeof fetch>(() => {
    const next = responses.shift() ?? json(500, {})
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
  const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve())
  const logs: SheetsLogEntry[] = []
  const deps = {
    token: token ?? { getToken: () => Promise.resolve({ ok: true as const, value: TOKEN }) },
    fetch: fetchMock,
    sleep,
    log: (entry: SheetsLogEntry) => logs.push(entry),
  }
  return { deps, fetchMock, sleep, logs }
}

describe('sheetsRequest', () => {
  it('sends the Bearer token to the Sheets URL and returns the parsed body', async () => {
    const { deps, fetchMock, logs } = setup([json(200, { spreadsheetId: 'sheet-123' })])
    expect(await sheetsRequest(READ, schema, deps)).toEqual({
      ok: true,
      value: { spreadsheetId: 'sheet-123' },
    })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe(
      'https://sheets.googleapis.com/v4/spreadsheets/sheet-123?fields=spreadsheetId',
    )
    expect((init!.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`)
    expect(init!.signal).toBeInstanceOf(AbortSignal)
    expect(logs).toEqual([])
  })

  it('sends a write body as JSON', async () => {
    const { deps, fetchMock } = setup([json(200, { spreadsheetId: 'sheet-123' })])
    await sheetsRequest(WRITE, schema, deps)
    const init = fetchMock.mock.calls[0]![1]!
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"requests":[]}')
  })

  it('classifies a body that fails the schema as invalid_sheet / unexpected_response', async () => {
    const { deps } = setup([json(200, { other: 1 })])
    expect(await sheetsRequest(READ, schema, deps)).toEqual({
      ok: false,
      error: { category: 'invalid_sheet', httpStatus: 200, reason: 'unexpected_response' },
    })
  })

  it.each([
    [401, 'UNAUTHENTICATED', 'permission_denied'],
    [403, 'PERMISSION_DENIED', 'permission_denied'],
    [404, 'NOT_FOUND', 'not_found'],
    [500, 'INTERNAL', 'network'],
  ] as const)('classifies %i as %s without retrying', async (status, reason, category) => {
    const { deps, fetchMock, sleep } = setup([googleError(status, reason)])
    expect(await sheetsRequest(READ, schema, deps)).toEqual({
      ok: false,
      error: { category, httpStatus: status, reason },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('classifies other 400s as invalid_sheet and flags range parse errors', async () => {
    const plain = setup([googleError(400, 'INVALID_ARGUMENT', 'Invalid requests[0]')])
    expect(await sheetsRequest(WRITE, schema, plain.deps)).toMatchObject({
      error: { category: 'invalid_sheet', httpStatus: 400, reason: 'bad_request' },
    })
    const range = setup([
      googleError(400, 'INVALID_ARGUMENT', 'Unable to parse range: Companies!A1:Z'),
    ])
    expect(await sheetsRequest(READ, schema, range.deps)).toMatchObject({
      error: { category: 'invalid_sheet', httpStatus: 400, reason: RANGE_PARSE_REASON },
    })
  })

  it('retries a read on 503 after 1 s and returns the later success', async () => {
    const { deps, fetchMock, sleep } = setup([
      googleError(503, 'UNAVAILABLE'),
      json(200, { spreadsheetId: 'sheet-123' }),
    ])
    expect(await sheetsRequest(READ, schema, deps)).toMatchObject({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sleep.mock.calls).toEqual([[1000]])
  })

  it('gives up on a persistent 429 after 4 attempts as rate_limited', async () => {
    const { deps, fetchMock, sleep } = setup(
      Array.from({ length: 5 }, () => googleError(429, 'RESOURCE_EXHAUSTED')),
    )
    expect(await sheetsRequest(WRITE, schema, deps)).toEqual({
      ok: false,
      error: { category: 'rate_limited', httpStatus: 429, reason: 'RESOURCE_EXHAUSTED' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(sleep.mock.calls).toEqual([[1000], [2000], [4000]])
  })

  it('does not retry a write on 503', async () => {
    const { deps, fetchMock, sleep } = setup([googleError(503, 'UNAVAILABLE')])
    expect(await sheetsRequest(WRITE, schema, deps)).toMatchObject({
      error: { category: 'network', httpStatus: 503 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('classifies a timeout and a connection error as network without retrying', async () => {
    const timeout = setup([new DOMException('The operation timed out.', 'TimeoutError')])
    expect(await sheetsRequest(READ, schema, timeout.deps)).toEqual({
      ok: false,
      error: { category: 'network', httpStatus: null, reason: 'timeout' },
    })
    expect(timeout.fetchMock).toHaveBeenCalledTimes(1)

    const offline = setup([new TypeError('fetch failed')])
    expect(await sheetsRequest(READ, schema, offline.deps)).toMatchObject({
      error: { category: 'network', httpStatus: null, reason: 'connection_error' },
    })
  })

  it('returns a token failure without calling the Sheets API', async () => {
    const { deps, fetchMock, logs } = setup([], {
      getToken: () =>
        Promise.resolve({
          ok: false,
          error: { category: 'permission_denied', httpStatus: 400, reason: 'invalid_grant' },
        }),
    })
    expect(await sheetsRequest(READ, schema, deps)).toMatchObject({
      error: { category: 'permission_denied', reason: 'invalid_grant' },
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logs).toEqual([
      {
        category: 'permission_denied',
        httpStatus: 400,
        reason: 'invalid_grant',
        method: 'POST',
        endpoint: 'token',
      },
    ])
  })

  it('logs only category, status, reason, method and endpoint', async () => {
    const { deps, logs } = setup([googleError(403, 'PERMISSION_DENIED', 'caller lacks access')])
    await sheetsRequest(WRITE, schema, deps)
    expect(logs).toEqual([
      {
        category: 'permission_denied',
        httpStatus: 403,
        reason: 'PERMISSION_DENIED',
        method: 'POST',
        endpoint: 'batchUpdate',
      },
    ])
    expect(JSON.stringify(logs)).not.toMatch(/Bearer|authorization|ya29|requests/i)
  })
})
