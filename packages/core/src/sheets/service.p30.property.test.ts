// Feature: google-sheets-sync, Property 30: Repeated Mark as applied adds one row
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { InMemorySheetsGateway } from '../test/fake-gateway'
import { job } from '../test/fixtures'
import { APPLICATIONS_TAB_TITLE, arbSheetState } from '../test/sheets-arbitraries'
import { normalizeHeader } from './header'
import { jobIdFor } from './matcher'
import { createSheetsService } from './service'

const JOB = job({ id: 'p30-target', company: 'P30 Company', title: 'P30 Intern' })
const JOB_ID = jobIdFor(JOB)

function serviceFor(gateway: InMemorySheetsGateway) {
  return createSheetsService({
    gateway,
    settings: {
      resumeVersion: '',
      timeZone: 'America/New_York',
      applicationsTab: APPLICATIONS_TAB_TITLE,
    },
    now: () => new Date('2026-11-17T15:00:00Z'),
    randomSheetId: () => 54_321,
    onWrite: () => {},
  })
}

function rowsWithJobId(gateway: InMemorySheetsGateway): number {
  const tab = gateway.tab(APPLICATIONS_TAB_TITLE)
  const [header = [], ...rows] = tab?.rows ?? []
  const column = header.findIndex((cell) => normalizeHeader(cell) === 'job id')
  return rows.filter((values) => values[column]?.trim() === JOB_ID).length
}

function expectOneRecorded(kinds: string[], statuses: (string | undefined)[]) {
  expect(kinds.filter((kind) => kind === 'success')).toHaveLength(1)
  expect(kinds.filter((kind) => kind === 'already_recorded')).toHaveLength(kinds.length - 1)
  for (const status of statuses) expect(status).toBe('Submitted')
}

describe('Property 30: repeated Mark as applied adds one row', () => {
  it('sequential presses: one success, then already_recorded, each within 2 reads and 1 write', async () => {
    await fc.assert(
      fc.asyncProperty(arbSheetState, fc.integer({ min: 1, max: 10 }), async (state, n) => {
        const gateway = new InMemorySheetsGateway(state)
        const service = serviceFor(gateway)
        const kinds: string[] = []
        const statuses: (string | undefined)[] = []
        for (let i = 0; i < n; i += 1) {
          const reads = gateway.count('read')
          const writes = gateway.count('write')
          const result = await service.markAsApplied(JOB)
          kinds.push(result.kind)
          if (result.kind === 'already_recorded') statuses.push(result.status)
          expect(gateway.count('read') - reads).toBeLessThanOrEqual(2)
          expect(gateway.count('write') - writes).toBeLessThanOrEqual(1)
        }
        expectOneRecorded(kinds, statuses)
        expect(rowsWithJobId(gateway)).toBe(1)
        expect(gateway.count('write')).toBe(1)
      }),
      { numRuns: 100 },
    )
  })

  it('concurrent presses in any interleaving add exactly one row', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSheetState,
        fc.integer({ min: 1, max: 10 }),
        fc.scheduler(),
        async (state, n, s) => {
          const gateway = new InMemorySheetsGateway(state, {
            onCall: () => ({ wait: () => s.schedule(Promise.resolve()) }),
          })
          const service = serviceFor(gateway)
          const pending = Array.from({ length: n }, () => service.markAsApplied(JOB))
          // Keeps releasing scheduled gateway calls, including the ones queued behind the mutex.
          const results = await s.waitFor(Promise.all(pending))
          expectOneRecorded(
            results.map((result) => result.kind),
            results.flatMap((result) =>
              result.kind === 'already_recorded' ? [result.status] : [],
            ),
          )
          expect(rowsWithJobId(gateway)).toBe(1)
          expect(gateway.count('write')).toBe(1)
          expect(gateway.count('read')).toBeLessThanOrEqual(2 * n)
        },
      ),
      { numRuns: 100 },
    )
  })
})
