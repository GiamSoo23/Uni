// Feature: google-sheets-sync, Property 3: Retry schedule and failure classification
import type { FailureCategory } from '@uni/core'
import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { RETRY_DELAYS_MS, sheetsRequest, type SheetsRequestOptions } from '@/lib/sheets/http'

type Outcome = 200 | 400 | 401 | 403 | 404 | 429 | 500 | 503 | 'connection_error'

const OUTCOMES: Outcome[] = [200, 400, 401, 403, 404, 429, 500, 503, 'connection_error']
const schema = z.object({ spreadsheetId: z.string() })
const OPTIONS: Record<'read' | 'write', SheetsRequestOptions> = {
  read: { method: 'GET', path: 'spreadsheets/sheet-123', kind: 'read' },
  write: {
    method: 'POST',
    path: 'spreadsheets/sheet-123:batchUpdate',
    body: { requests: [] },
    kind: 'write',
  },
}

function respond(outcome: Outcome): Promise<Response> {
  if (outcome === 'connection_error') return Promise.reject(new TypeError('fetch failed'))
  const body = outcome === 200 ? { spreadsheetId: 'sheet-123' } : { error: { code: outcome } }
  return Promise.resolve(new Response(JSON.stringify(body), { status: outcome }))
}

function categoryOf(outcome: Exclude<Outcome, 200>): FailureCategory {
  if (outcome === 'connection_error' || outcome === 500 || outcome === 503) return 'network'
  if (outcome === 401 || outcome === 403) return 'permission_denied'
  if (outcome === 404) return 'not_found'
  if (outcome === 429) return 'rate_limited'
  return 'invalid_sheet'
}

/** The reference model: how many attempts, and the final result, for a sequence of outcomes. */
function expected(outcomes: readonly Outcome[], kind: 'read' | 'write') {
  for (const [index, outcome] of outcomes.entries()) {
    if (outcome === 200) return { attempts: index + 1, category: null }
    const retryable = outcome === 429 || (outcome === 503 && kind === 'read')
    if (!retryable || index === outcomes.length - 1) {
      return { attempts: index + 1, category: categoryOf(outcome) }
    }
  }
  throw new Error('unreachable')
}

describe('Property 3: retry schedule and failure classification', () => {
  it('retries only 429 (and 503 on reads) after 1, 2 and 4 s and returns one category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(...OUTCOMES), { minLength: 4, maxLength: 4 }),
        fc.constantFrom<'read' | 'write'>('read', 'write'),
        async (outcomes, kind) => {
          const queue = [...outcomes]
          const fetchMock = vi.fn<typeof fetch>(() => respond(queue.shift() ?? 200))
          const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve())
          const result = await sheetsRequest(OPTIONS[kind], schema, {
            token: { getToken: () => Promise.resolve({ ok: true, value: 'tok' }) },
            fetch: fetchMock,
            sleep,
            log: () => {},
          })

          const model = expected(outcomes, kind)
          expect(fetchMock).toHaveBeenCalledTimes(model.attempts)
          expect(sleep.mock.calls.map(([ms]) => ms)).toEqual(
            RETRY_DELAYS_MS.slice(0, model.attempts - 1),
          )
          if (model.category === null) {
            expect(result).toEqual({ ok: true, value: { spreadsheetId: 'sheet-123' } })
          } else {
            expect(result.ok).toBe(false)
            if (!result.ok) expect(result.error.category).toBe(model.category)
          }
        },
      ),
      { numRuns: 300 },
    )
  })
})
