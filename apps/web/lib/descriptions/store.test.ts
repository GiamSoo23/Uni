import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { DescriptionRead, DescriptionReader, Job } from '@uni/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COOLDOWN_MS, createDescriptionStore, RECHECK_MS, RETRY_MS, type ScanLimits } from './store'

const GREENHOUSE = (id: number) => `https://job-boards.greenhouse.io/acme/jobs/${id}`
const WORKDAY = (id: number) => `https://acme.wd1.myworkdayjobs.com/site/job/Remote/Intern_${id}`

function role(id: string, url: string, updatedAt: Date | null = null): Job {
  return {
    id,
    source: 'simplify',
    company: 'Acme',
    title: 'Software Engineer Intern',
    url,
    locations: ['Remote'],
    terms: ['Summer 2027'],
    category: 'Software',
    sponsorship: 'unknown',
    degrees: [],
    active: true,
    postedAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt,
  }
}

const LIMITS: ScanLimits = { perScan: 50, concurrency: 2, workdayPerScan: 2, workdayGapMs: 0 }

let dir: string
let clock: number

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'uni-descriptions-'))
  clock = Date.parse('2026-11-19T12:00:00Z')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function setup(answer: (url: string) => DescriptionRead, limits = LIMITS) {
  const read = vi.fn((url: string) => Promise.resolve(answer(url)))
  const reader: DescriptionReader = { read }
  const file = path.join(dir, 'descriptions', 'flags.json')
  const make = () =>
    createDescriptionStore({
      file,
      createReader: () => reader,
      now: () => clock,
      limits,
      sleep: () => Promise.resolve(),
      log: () => {},
    })
  return { read, file, store: make(), make }
}

const text = (value: string): DescriptionRead => ({ kind: 'text', text: value })

describe('createDescriptionStore', () => {
  it('flags a posting, keeps the quote and never stores the description', async () => {
    const { store, file } = setup(() => text('Secret project. Must be a U.S. citizen.'))
    await store.scan([role('a', GREENHOUSE(1))])

    expect([...(await store.index())]).toEqual([
      ['simplify:a', { kind: 'citizenship_required', quote: 'Must be a U.S. citizen.' }],
    ])
    const saved = await readFile(file, 'utf8')
    expect(saved).not.toContain('Secret project')
    expect(JSON.parse(saved).entries['simplify:a']).toMatchObject({ outcome: 'flagged' })
  })

  it('reloads saved results in a new process without reading again', async () => {
    const { store, make, read } = setup(() => text('No visa sponsorship.'))
    await store.scan([role('a', GREENHOUSE(1))])
    const restarted = make()
    await restarted.scan([role('a', GREENHOUSE(1))])

    expect(read).toHaveBeenCalledTimes(1)
    expect((await restarted.index()).get('simplify:a')?.kind).toBe('no_sponsorship')
  })

  it('skips URLs it cannot read and counts coverage over the readable ones', async () => {
    const { store, read } = setup(() => text('Great internship.'))
    const jobs = [role('a', GREENHOUSE(1)), role('b', 'https://careers.example.com/1')]
    expect(await store.coverage(jobs)).toEqual({ readable: 1, read: 0, refused: [] })
    await store.scan(jobs)

    expect(read).toHaveBeenCalledTimes(1)
    expect(await store.coverage(jobs)).toEqual({ readable: 1, read: 1, refused: [] })
  })

  it('reads a posting again after a week, or when the job changes', async () => {
    const { store, read } = setup(() => text('Great internship.'))
    await store.scan([role('a', GREENHOUSE(1))])
    await store.scan([role('a', GREENHOUSE(1))])
    expect(read).toHaveBeenCalledTimes(1)

    await store.scan([role('a', GREENHOUSE(1), new Date('2026-11-19T00:00:00Z'))])
    expect(read).toHaveBeenCalledTimes(2)

    clock += RECHECK_MS
    await store.scan([role('a', GREENHOUSE(1), new Date('2026-11-19T00:00:00Z'))])
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('never reads a removed posting again', async () => {
    const { store, read } = setup(() => ({ kind: 'gone' }))
    await store.scan([role('a', GREENHOUSE(1))])
    clock += RECHECK_MS * 4
    await store.scan([role('a', GREENHOUSE(1))])
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('retries a failure after six hours', async () => {
    const { store, read } = setup(() => ({ kind: 'failed', reason: 'timeout' }))
    await store.scan([role('a', GREENHOUSE(1))])
    clock += RETRY_MS - 1
    await store.scan([role('a', GREENHOUSE(1))])
    expect(read).toHaveBeenCalledTimes(1)
    clock += 1
    await store.scan([role('a', GREENHOUSE(1))])
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('keeps the last flag when a weekly re-read fails', async () => {
    let answer: DescriptionRead = text('No visa sponsorship.')
    const { store } = setup(() => answer)
    await store.scan([role('a', GREENHOUSE(1))])
    answer = { kind: 'failed', reason: 'http_500' }
    clock += RECHECK_MS
    await store.scan([role('a', GREENHOUSE(1))])

    expect((await store.index()).get('simplify:a')?.kind).toBe('no_sponsorship')
  })

  it('stops reading Workday after a 429 and leaves the rest due', async () => {
    const { store, read } = setup((url) =>
      url.includes('myworkdayjobs') ? { kind: 'failed', reason: 'http_429' } : text('Fine.'),
    )
    const jobs = [
      role('w1', WORKDAY(1)),
      role('w2', WORKDAY(2)),
      role('g1', GREENHOUSE(1)),
      role('g2', GREENHOUSE(2)),
    ]
    const workdayCalls = () => read.mock.calls.filter(([url]) => url.includes('myworkdayjobs'))
    await store.scan(jobs)
    expect(workdayCalls()).toHaveLength(1)
    // Both unread Workday postings count as refused, including the one never tried.
    expect(await store.coverage(jobs)).toEqual({
      readable: 4,
      read: 2,
      refused: [{ ats: 'workday', count: 2 }],
    })

    // Paused for an hour: a second scan doesn't touch Workday.
    await store.scan(jobs)
    expect(workdayCalls()).toHaveLength(1)

    // After the hour, Workday is tried again and no longer counts as refused.
    clock += COOLDOWN_MS
    expect((await store.coverage(jobs)).refused).toEqual([])
    await store.scan(jobs)
    expect(workdayCalls()).toHaveLength(2)
  })

  it('respects the per-scan limits, in the order given', async () => {
    const { store, read } = setup(() => text('Fine.'), {
      ...LIMITS,
      perScan: 3,
      workdayPerScan: 1,
    })
    await store.scan([
      role('w1', WORKDAY(1)),
      role('w2', WORKDAY(2)),
      role('g1', GREENHOUSE(1)),
      role('g2', GREENHOUSE(2)),
      role('g3', GREENHOUSE(3)),
    ])
    expect(read.mock.calls.map(([url]) => url).sort()).toEqual(
      [WORKDAY(1), GREENHOUSE(1), GREENHOUSE(2)].sort(),
    )
  })

  it('runs one scan at a time', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((done) => {
      release = done
    })
    const read = vi.fn(async () => {
      await gate
      return text('Fine.')
    })
    const store = createDescriptionStore({
      file: path.join(dir, 'flags.json'),
      createReader: () => ({ read }),
      now: () => clock,
      limits: LIMITS,
      log: () => {},
    })
    const first = store.scan([role('a', GREENHOUSE(1))])
    await store.scan([role('a', GREENHOUSE(1))])
    release()
    await first
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('starts empty when the file is missing or corrupt', async () => {
    const file = path.join(dir, 'flags.json')
    await writeFile(file, '{ not json', 'utf8')
    const store = createDescriptionStore({
      file,
      createReader: () => ({ read: () => Promise.resolve(text('Fine.')) }),
      now: () => clock,
      log: () => {},
    })
    expect((await store.index()).size).toBe(0)
  })
})
