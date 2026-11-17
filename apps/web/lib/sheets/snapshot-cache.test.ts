import type { Grid, SheetsFailure, SheetsGateway } from '@uni/core'
import { describe, expect, it, vi } from 'vitest'
import { CACHE_TTL_MS, createSnapshotCache, type SheetState } from '@/lib/sheets/snapshot-cache'

type Snapshot = Awaited<ReturnType<SheetsGateway['readSnapshot']>>

const EMAIL = 'uni@project.iam.gserviceaccount.com'
const HEADER = ['Company', 'Role', 'Link', 'Date Applied', 'Status', 'Notes', 'Job ID']

const grid = (...rows: string[][]): Grid =>
  rows.map((row) => row.map((text) => ({ text, hyperlink: null, runLinks: [] })))
const tracker = (...rows: string[][]) => grid(HEADER, ...rows)
const ok = (applications: Grid, companies: Grid | null = null): Snapshot => ({
  ok: true,
  value: { applications, companies, tabs: [] },
})
const fail = (category: SheetsFailure['category']): Snapshot => ({
  ok: false,
  error: { category, httpStatus: null, reason: 'test' },
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

function setup(...responses: (Snapshot | Promise<Snapshot>)[]) {
  let clock = 1_000_000
  const readSnapshot = vi.fn<SheetsGateway['readSnapshot']>(() => {
    const next = responses.shift()
    if (next === undefined) throw new Error('unexpected read')
    return Promise.resolve(next)
  })
  const cache = createSnapshotCache({
    mode: 'enabled',
    gateway: { readSnapshot },
    applicationsTab: 'Tracker',
    clientEmail: EMAIL,
    now: () => clock,
  })
  return {
    cache,
    readSnapshot,
    advance: (ms: number) => {
      clock += ms
    },
    at: () => clock,
  }
}

const enabled = (state: SheetState) => {
  if (state.mode !== 'enabled') throw new Error('expected enabled')
  return state
}
const companies = (state: SheetState) =>
  enabled(state).snapshot?.applications.map((row) => row.company)

describe('createSnapshotCache', () => {
  it('reports the problem names in disabled mode and never reads', async () => {
    const cache = createSnapshotCache({
      mode: 'disabled',
      problems: [{ name: 'UNI_SHEET_ID', kind: 'missing' }],
    })
    expect(await cache.getSheetState()).toEqual({
      mode: 'disabled',
      problems: [{ name: 'UNI_SHEET_ID', kind: 'missing' }],
    })
    expect(() => cache.clearSheetCache()).not.toThrow()
  })

  it('parses the applications and Companies tabs into one snapshot', async () => {
    const { cache, readSnapshot, at } = setup(
      ok(
        tracker(['Acme', 'SWE', '', '', 'Submitted', '', 'simplify:1']),
        grid(
          ['Company', 'Policy', 'Note', 'Checked'],
          ['Acme', 'no sponsorship', 'Said so on the call', '2026-11-12'],
        ),
      ),
    )
    const state = enabled(await cache.getSheetState())
    expect(readSnapshot).toHaveBeenCalledWith('Tracker')
    expect(state.failure).toBeNull()
    expect(state.readAt).toEqual(new Date(at()))
    expect(state.clientEmail).toBe(EMAIL)
    expect(state.snapshot?.applications).toMatchObject([
      { rowNumber: 2, company: 'Acme', status: 'Submitted', jobId: 'simplify:1' },
    ])
    expect(state.snapshot?.overrides).toMatchObject([
      { company: 'Acme', policy: 'no_sponsorship', source: 'sheet' },
    ])
  })

  it('serves the cache for 60 s, then reads again', async () => {
    const { cache, readSnapshot, advance } = setup(ok(tracker(['A'])), ok(tracker(['B'])))
    expect(companies(await cache.getSheetState())).toEqual(['A'])
    advance(CACHE_TTL_MS - 1)
    expect(companies(await cache.getSheetState())).toEqual(['A'])
    expect(readSnapshot).toHaveBeenCalledTimes(1)
    advance(1)
    expect(companies(await cache.getSheetState())).toEqual(['B'])
    expect(readSnapshot).toHaveBeenCalledTimes(2)
  })

  it('keeps the last success and its read time when a read fails', async () => {
    const { cache, advance } = setup(ok(tracker(['A'])), fail('rate_limited'))
    const first = enabled(await cache.getSheetState())
    advance(CACHE_TTL_MS)
    const second = enabled(await cache.getSheetState())
    expect(second.failure?.category).toBe('rate_limited')
    expect(companies(second)).toEqual(['A'])
    expect(second.readAt).toEqual(first.readAt)
  })

  it('returns no snapshot when the first read fails', async () => {
    const { cache } = setup(fail('permission_denied'))
    const state = enabled(await cache.getSheetState())
    expect(state).toMatchObject({ snapshot: null, readAt: null })
    expect(state.failure?.category).toBe('permission_denied')
  })

  it('treats a missing required header as an invalid_sheet failure', async () => {
    const { cache } = setup(ok(grid(['Company', 'Role'], ['Acme', 'SWE'])))
    const state = enabled(await cache.getSheetState())
    expect(state.failure).toMatchObject({ category: 'invalid_sheet', reason: 'missing_columns' })
    expect(state.snapshot).toBeNull()
  })

  it('turns a thrown error into a network failure', async () => {
    const { cache, readSnapshot } = setup()
    readSnapshot.mockRejectedValueOnce(new Error('boom'))
    const state = enabled(await cache.getSheetState())
    expect(state.failure).toMatchObject({ category: 'network', reason: 'unexpected_error' })
  })

  it('gives concurrent callers one shared read', async () => {
    const pending = deferred<Snapshot>()
    const { cache, readSnapshot } = setup(pending.promise)
    const calls = [cache.getSheetState(), cache.getSheetState(), cache.getSheetState()]
    pending.resolve(ok(tracker(['A'])))
    const states = await Promise.all(calls)
    expect(readSnapshot).toHaveBeenCalledTimes(1)
    for (const state of states) expect(companies(state)).toEqual(['A'])
  })

  it('gives concurrent callers the same failure', async () => {
    const pending = deferred<Snapshot>()
    const { cache, readSnapshot } = setup(pending.promise)
    const calls = [cache.getSheetState(), cache.getSheetState()]
    pending.resolve(fail('network'))
    const states = await Promise.all(calls)
    expect(readSnapshot).toHaveBeenCalledTimes(1)
    for (const state of states) expect(enabled(state).failure?.category).toBe('network')
  })

  it('reads again after a clear', async () => {
    const { cache, readSnapshot } = setup(ok(tracker(['A'])), ok(tracker(['B'])))
    await cache.getSheetState()
    cache.clearSheetCache()
    expect(companies(await cache.getSheetState())).toEqual(['B'])
    expect(readSnapshot).toHaveBeenCalledTimes(2)
  })

  it('does not let a read that started before a clear fill the cache', async () => {
    const before = deferred<Snapshot>()
    const { cache, readSnapshot } = setup(before.promise, ok(tracker(['after'])))
    const early = cache.getSheetState()
    cache.clearSheetCache()
    before.resolve(ok(tracker(['before'])))
    // Callers that asked before the clear still get the result of their read.
    expect(companies(await early)).toEqual(['before'])
    expect(companies(await cache.getSheetState())).toEqual(['after'])
    expect(readSnapshot).toHaveBeenCalledTimes(2)
  })

  it('does not join a pre-clear read that is still in flight', async () => {
    const before = deferred<Snapshot>()
    const { cache, readSnapshot } = setup(before.promise, ok(tracker(['after'])))
    const early = cache.getSheetState()
    cache.clearSheetCache()
    const late = cache.getSheetState()
    before.resolve(ok(tracker(['before'])))
    expect(companies(await late)).toEqual(['after'])
    expect(companies(await early)).toEqual(['before'])
    expect(readSnapshot).toHaveBeenCalledTimes(2)
    // The post-clear read is the one cached.
    expect(companies(await cache.getSheetState())).toEqual(['after'])
  })
})
