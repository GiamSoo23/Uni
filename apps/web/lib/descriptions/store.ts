import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  type DescriptionAts,
  type DescriptionFlag,
  type DescriptionIndex,
  type DescriptionReader,
  descriptionSourceFor,
  detectRestrictions,
  DETECTOR_VERSION,
  type Job,
  jobIdFor,
  RESTRICTION_KINDS,
  strongestFlag,
} from '@uni/core'
import { z } from 'zod'

const HOUR_MS = 60 * 60 * 1000

/** How long a read posting is trusted before it's read again. */
export const RECHECK_MS = 7 * 24 * HOUR_MS
/** How long to wait after a failed read. */
export const RETRY_MS = 6 * HOUR_MS
/** How long an ATS that answered 429 is left alone. */
export const COOLDOWN_MS = HOUR_MS

export interface ScanLimits {
  /** Postings read per scan, across every ATS. */
  perScan: number
  /** Parallel reads for Greenhouse, Lever and Ashby. */
  concurrency: number
  /** Workday rate limits by IP across every company, so it gets one slow lane with its own cap. */
  workdayPerScan: number
  workdayGapMs: number
}

export const DEFAULT_LIMITS: ScanLimits = {
  perScan: 150,
  concurrency: 4,
  workdayPerScan: 20,
  workdayGapMs: 1500,
}

const flagSchema = z.object({ kind: z.enum(RESTRICTION_KINDS), quote: z.string() })

const entrySchema = z.object({
  checkedAt: z.iso.datetime(),
  /** The job's `updatedAt` when it was read: a change means it's read again. */
  jobUpdatedAt: z.iso.datetime().nullable(),
  detector: z.number().int(),
  outcome: z.enum(['clear', 'flagged', 'gone', 'failed']),
  /** Why the last read failed, such as `http_429` or `timeout`. */
  reason: z.string().optional(),
  /** First 16 hex digits of the description's SHA-256, to tell when it changed. */
  hash: z.string().optional(),
  /** A re-read that failed: the last good result is kept and retried after `RETRY_MS`. */
  failedAt: z.iso.datetime().optional(),
  flags: z.array(flagSchema),
})
type Entry = z.infer<typeof entrySchema>

const fileSchema = z.object({ version: z.literal(1), entries: z.record(z.string(), entrySchema) })

export interface DescriptionCoverage {
  /** Postings in the list that Uni can read. */
  readable: number
  /** Of those, how many it has read. */
  read: number
  /**
   * Unread postings on an ATS that answered 429 within the last hour, most first. Workday refuses
   * cloud networks such as Vercel's, so online this is usually every Workday posting.
   */
  refused: { ats: DescriptionAts; count: number }[]
}

export interface DescriptionStore {
  /** The strongest flag of every flagged posting. */
  index(): Promise<DescriptionIndex>
  /** How many postings of `jobs` have been read. */
  coverage(jobs: readonly Job[]): Promise<DescriptionCoverage>
  /**
   * Reads the postings of `jobs` that are due, in the given order, within the scan limits. Only one
   * scan runs at a time: a call during a scan returns at once. It never throws.
   */
  scan(jobs: readonly Job[]): Promise<void>
}

export interface DescriptionStoreOptions {
  /** The JSON file results are kept in. */
  file: string
  createReader: () => DescriptionReader
  now?: () => number
  limits?: ScanLimits
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
}

const hashOf = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)

const iso = (date: Date | null) => (date === null ? null : date.toISOString())

/**
 * Keeps what Uni learned from each posting's description: the flags and when it was read, never
 * the description itself. Results live in one JSON file so a restart doesn't read everything
 * again; on Vercel that file is in `/tmp` and lasts as long as the instance.
 */
export function createDescriptionStore(options: DescriptionStoreOptions): DescriptionStore {
  const now = options.now ?? Date.now
  const limits = options.limits ?? DEFAULT_LIMITS
  const sleep = options.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)))
  const log = options.log ?? ((message: string) => console.warn(message))

  let entries: Map<string, Entry> | null = null
  let loading: Promise<Map<string, Entry>> | null = null
  let cachedIndex: DescriptionIndex | null = null
  let scanning = false
  const pausedUntil = new Map<DescriptionAts, number>()

  async function load(): Promise<Map<string, Entry>> {
    if (entries !== null) return entries
    loading ??= readFile(options.file, 'utf8')
      .then((text) => {
        const parsed = fileSchema.safeParse(JSON.parse(text))
        return new Map(parsed.success ? Object.entries(parsed.data.entries) : [])
      })
      .catch(() => new Map<string, Entry>())
      .then((loaded) => {
        entries = loaded
        return loaded
      })
    return loading
  }

  async function save(current: Map<string, Entry>): Promise<void> {
    const body = JSON.stringify({ version: 1, entries: Object.fromEntries(current) })
    await mkdir(path.dirname(options.file), { recursive: true })
    const tmp = `${options.file}.${process.pid}.tmp`
    await writeFile(tmp, body, 'utf8')
    await rename(tmp, options.file)
  }

  function isDue(entry: Entry | undefined, job: Job, at: number): boolean {
    if (entry === undefined) return true
    if (entry.jobUpdatedAt !== iso(job.updatedAt)) return true
    const age = at - Date.parse(entry.checkedAt)
    switch (entry.outcome) {
      case 'gone':
        return false
      case 'failed':
        return age >= RETRY_MS
      case 'clear':
      case 'flagged':
        if (entry.failedAt !== undefined && at - Date.parse(entry.failedAt) < RETRY_MS) return false
        return entry.detector !== DETECTOR_VERSION || age >= RECHECK_MS
    }
  }

  function buildIndex(current: Map<string, Entry>): DescriptionIndex {
    const index = new Map<string, DescriptionFlag>()
    for (const [id, entry] of current) {
      const flag = entry.outcome === 'flagged' ? strongestFlag(entry.flags) : null
      if (flag !== null) index.set(id, flag)
    }
    return index
  }

  async function readOne(reader: DescriptionReader, job: Job): Promise<Entry> {
    const base = { checkedAt: new Date(now()).toISOString(), jobUpdatedAt: iso(job.updatedAt) }
    const read = await reader.read(job.url)
    switch (read.kind) {
      case 'text': {
        const flags = detectRestrictions(read.text)
        return {
          ...base,
          detector: DETECTOR_VERSION,
          outcome: flags.length > 0 ? 'flagged' : 'clear',
          hash: hashOf(read.text),
          flags,
        }
      }
      case 'gone':
        return { ...base, detector: DETECTOR_VERSION, outcome: 'gone', flags: [] }
      case 'unsupported':
      case 'failed':
        return {
          ...base,
          detector: DETECTOR_VERSION,
          outcome: 'failed',
          reason: read.kind === 'failed' ? read.reason : 'unsupported',
          flags: [],
        }
    }
  }

  async function runLane(
    jobs: readonly Job[],
    ats: DescriptionAts | 'other',
    workers: number,
    gapMs: number,
    reader: DescriptionReader,
    current: Map<string, Entry>,
  ): Promise<void> {
    let next = 0
    let stopped = false
    const worker = async () => {
      while (!stopped && next < jobs.length) {
        const job = jobs[next]
        next += 1
        if (job === undefined) break
        const source = descriptionSourceFor(job.url)
        if (source === null || (pausedUntil.get(source.ats) ?? 0) > now()) continue
        const id = jobIdFor(job)
        const entry = await readOne(reader, job)
        const previous = current.get(id)
        // A failed re-read keeps what the last good read found.
        const keep =
          entry.outcome === 'failed' &&
          (previous?.outcome === 'clear' || previous?.outcome === 'flagged')
        current.set(
          id,
          keep ? { ...previous, failedAt: entry.checkedAt, reason: entry.reason } : entry,
        )
        if (entry.reason === 'http_429') {
          pausedUntil.set(source.ats, now() + COOLDOWN_MS)
          log(`Descriptions: ${source.ats} answered 429, pausing it for an hour`)
          if (ats !== 'other') stopped = true
        }
        if (gapMs > 0) await sleep(gapMs)
      }
    }
    await Promise.all(Array.from({ length: workers }, worker))
  }

  return {
    async index() {
      const current = await load()
      cachedIndex ??= buildIndex(current)
      return cachedIndex
    },

    async coverage(jobs) {
      const current = await load()
      const at = now()
      let readable = 0
      let read = 0
      const refused = new Map<DescriptionAts, number>()
      for (const job of jobs) {
        const source = descriptionSourceFor(job.url)
        if (source === null) continue
        readable += 1
        const outcome = current.get(jobIdFor(job))?.outcome
        if (outcome === 'clear' || outcome === 'flagged') {
          read += 1
        } else if ((pausedUntil.get(source.ats) ?? 0) > at) {
          refused.set(source.ats, (refused.get(source.ats) ?? 0) + 1)
        }
      }
      return {
        readable,
        read,
        refused: [...refused]
          .map(([ats, count]) => ({ ats, count }))
          .sort((a, b) => b.count - a.count),
      }
    },

    async scan(jobs) {
      if (scanning) return
      scanning = true
      try {
        const current = await load()
        const at = now()
        const workday: Job[] = []
        const other: Job[] = []
        for (const job of jobs) {
          if (workday.length + other.length >= limits.perScan) break
          const source = descriptionSourceFor(job.url)
          if (source === null || !isDue(current.get(jobIdFor(job)), job, at)) continue
          if ((pausedUntil.get(source.ats) ?? 0) > at) continue
          if (source.ats === 'workday') {
            if (workday.length < limits.workdayPerScan) workday.push(job)
          } else {
            other.push(job)
          }
        }
        if (workday.length + other.length === 0) return

        const reader = options.createReader()
        await Promise.all([
          runLane(other, 'other', limits.concurrency, 0, reader, current),
          runLane(workday, 'workday', 1, limits.workdayGapMs, reader, current),
        ])
        cachedIndex = buildIndex(current)
        await save(current)
      } catch (error) {
        log(`Descriptions: scan failed (${error instanceof Error ? error.name : 'unknown'})`)
      } finally {
        scanning = false
      }
    },
  }
}
