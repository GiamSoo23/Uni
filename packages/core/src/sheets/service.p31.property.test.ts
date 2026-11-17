// Feature: google-sheets-sync, Property 31: Undo removes exactly Uni's row, found by Job ID
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { type FakeSheetState, InMemorySheetsGateway } from '../test/fake-gateway'
import { job } from '../test/fixtures'
import { TRACKER_HEADER } from '../test/sheets-fixtures'
import { jobIdFor } from './matcher'
import { createSheetsService } from './service'

const HEADER = [...TRACKER_HEADER, 'Job ID']
const JOB = job({ id: 'p31-target', company: 'P31 Company', title: 'P31 Intern' })
const JOB_ID = jobIdFor(JOB)
const TRACKER_ID = 3

const at = (name: string) => HEADER.indexOf(name)
const rowOf = (company: string, role: string, jobId: string): string[] => {
  const values = HEADER.map(() => '')
  values[at('Company')] = company
  values[at('Role')] = role
  values[at('Status')] = 'Submitted'
  values[at('Job ID')] = jobId
  return values
}

const arbOtherRow = fc
  .record({
    company: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,12}$/),
    role: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,12}$/),
    jobId: fc.oneof(
      fc.constant(''),
      fc.uuid().map((id) => `simplify:${id}`),
    ),
  })
  .map(({ company, role, jobId }) => rowOf(company, role, jobId))

/** A Tracker with k rows owned by JOB_ID among other rows, in random order, and spare grid rows. */
const arbState = fc
  .tuple(
    fc.integer({ min: 0, max: 3 }),
    fc.array(arbOtherRow, { maxLength: 8 }),
    fc.nat({ max: 3 }),
  )
  .chain(([k, others, spare]) => {
    const owned = Array.from({ length: k }, (_, i) =>
      rowOf('P31 Company', `P31 Intern ${i}`, JOB_ID),
    )
    const all = [...owned, ...others]
    return fc
      .shuffledSubarray(all, { minLength: all.length, maxLength: all.length })
      .map((data): { k: number; state: FakeSheetState } => ({
        k,
        state: {
          tabs: [
            {
              sheetId: TRACKER_ID,
              title: 'Tracker',
              rowCount: 1 + data.length + spare,
              columnCount: HEADER.length,
              rows: [[...HEADER], ...data],
            },
            { sheetId: 8, title: 'Summary', rowCount: 2, columnCount: 2, rows: [['Total', '1']] },
          ],
        },
      }))
  })

function serviceFor(gateway: InMemorySheetsGateway) {
  return createSheetsService({
    gateway,
    settings: { resumeVersion: '', timeZone: 'America/New_York', applicationsTab: 'Tracker' },
    now: () => new Date('2026-11-17T15:00:00Z'),
    randomSheetId: () => 99,
    onWrite: () => {},
  })
}

const tracker = (gateway: InMemorySheetsGateway) => {
  const tab = gateway.tab('Tracker')
  if (tab === undefined) throw new Error('Tracker is missing')
  return tab
}

describe('Property 31: Undo removes exactly Uni’s row, found by Job ID', () => {
  it('deletes the one owned row, or refuses with the count', async () => {
    await fc.assert(
      fc.asyncProperty(arbState, async ({ k, state }) => {
        const gateway = new InMemorySheetsGateway(state)
        const before = tracker(gateway)
        const result = await serviceFor(gateway).undoMarkAsApplied(JOB_ID)

        expect(gateway.count('read')).toBe(1)
        if (k === 1) {
          expect(result).toEqual({ kind: 'success', jobId: JOB_ID })
          expect(gateway.count('write')).toBe(1)
          const after = tracker(gateway)
          expect(after.rows).toEqual(
            before.rows.filter((values) => values[at('Job ID')] !== JOB_ID),
          )
          expect(after.rowCount).toBe(before.rowCount - 1)
        } else {
          expect(result).toEqual({ kind: 'not_unique', jobId: JOB_ID, found: k })
          expect(gateway.count('write')).toBe(0)
          expect(tracker(gateway)).toEqual(before)
        }
        expect(gateway.tab('Summary')).toEqual(state.tabs[1])
      }),
      { numRuns: 200 },
    )
  })

  it('Mark as applied then Undo leaves the tab as it was after setup', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbState.filter(({ k }) => k === 0),
        async ({ state }) => {
          const gateway = new InMemorySheetsGateway(state)
          const service = serviceFor(gateway)
          const before = tracker(gateway)
          expect((await service.markAsApplied(JOB)).kind).toBe('success')
          const reads = gateway.count('read')
          expect(await service.undoMarkAsApplied(JOB_ID)).toEqual({
            kind: 'success',
            jobId: JOB_ID,
          })
          expect(gateway.count('read') - reads).toBe(1)
          expect(gateway.count('write')).toBe(2)
          const after = tracker(gateway)
          expect(after.rows).toEqual(before.rows)
          expect(after.rowCount).toBe(before.rowCount)
        },
      ),
      { numRuns: 150 },
    )
  })
})
