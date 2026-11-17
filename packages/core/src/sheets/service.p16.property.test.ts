// Feature: google-sheets-sync, Property 16: Uni only writes its own cells
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { type FakeTab, InMemorySheetsGateway } from '../test/fake-gateway'
import { job } from '../test/fixtures'
import { APPLICATIONS_TAB_TITLE, arbSheetState } from '../test/sheets-arbitraries'
import { normalizeHeader } from './header'
import { jobIdFor } from './matcher'
import { COMPANIES_COLUMNS } from './overrides'
import { createSheetsService } from './service'

const JOBS = [0, 1, 2].map((n) =>
  job({ id: `p16-${n}`, company: `P16 Company ${n}`, title: `=P16 role ${n}` }),
)
const OWN_IDS = new Set(JOBS.map(jobIdFor))

/** A row without its trailing empty cells. */
const trimRow = (values: readonly string[]): string[] => {
  const copy = [...values]
  while (copy.length > 0 && copy.at(-1) === '') copy.pop()
  return copy
}
/** Rows without trailing empty cells, then without trailing empty rows. */
const trimRows = (rows: readonly (readonly string[])[]): string[][] => {
  const copy = rows.map(trimRow)
  while (copy.length > 0 && copy.at(-1)?.length === 0) copy.pop()
  return copy
}
const sameTitle = (a: string, b: string) => normalizeHeader(a) === normalizeHeader(b)

const arbCalls = fc.array(
  fc.record({ kind: fc.constantFrom('mark', 'undo'), job: fc.constantFrom(...JOBS) }),
  { minLength: 1, maxLength: 6 },
)

describe('Property 16: Uni only writes its own cells', () => {
  it('keeps every existing cell and adds only its rows, the Job ID header and the Companies tab', async () => {
    await fc.assert(
      fc.asyncProperty(arbSheetState, arbCalls, async (state, calls) => {
        const gateway = new InMemorySheetsGateway(state)
        const service = createSheetsService({
          gateway,
          settings: {
            resumeVersion: '',
            timeZone: 'America/New_York',
            applicationsTab: APPLICATIONS_TAB_TITLE,
          },
          now: () => new Date('2026-11-17T15:00:00Z'),
          randomSheetId: () => 12_345,
          onWrite: () => {},
        })
        for (const call of calls) {
          if (call.kind === 'mark') await service.markAsApplied(call.job)
          else await service.undoMarkAsApplied(jobIdFor(call.job))
        }

        const after = gateway.state()
        const hadCompanies = state.tabs.some((tab) => sameTitle(tab.title, 'Companies'))

        // Other tabs and an existing Companies tab are untouched.
        for (const before of state.tabs) {
          if (sameTitle(before.title, APPLICATIONS_TAB_TITLE)) continue
          expect(after.tabs.find((tab) => tab.sheetId === before.sheetId)).toEqual(before)
        }
        // The only new tab is a Companies tab holding just its header.
        const added = after.tabs.filter(
          (tab) => !state.tabs.some((old) => old.sheetId === tab.sheetId),
        )
        expect(added.length).toBeLessThanOrEqual(hadCompanies ? 0 : 1)
        for (const tab of added) {
          expect(sameTitle(tab.title, 'Companies')).toBe(true)
          expect(trimRows(tab.rows)).toEqual([[...COMPANIES_COLUMNS]])
        }

        // In the applications tab, removing Uni's rows gives back the old rows, apart from the
        // Job ID header cell that setup may add to the right of the last header.
        const oldTracker = state.tabs.find((tab) =>
          sameTitle(tab.title, APPLICATIONS_TAB_TITLE),
        ) as FakeTab
        const newTracker = after.tabs.find((tab) => tab.sheetId === oldTracker.sheetId) as FakeTab
        const [oldHeader = [], ...oldData] = trimRows(oldTracker.rows)
        const [newHeader = [], ...newData] = trimRows(newTracker.rows)
        const jobIdColumn = newHeader.findIndex((cell) => sameTitle(cell, 'Job ID'))
        const kept = newData.filter((values) => !OWN_IDS.has(values[jobIdColumn] ?? ''))
        expect(trimRows(kept)).toEqual(trimRows(oldData))

        const extraHeader = newHeader.flatMap((cell, i) =>
          cell === (oldHeader[i] ?? '') ? [] : [i],
        )
        if (oldHeader.some((cell) => sameTitle(cell, 'Job ID'))) {
          expect(extraHeader).toEqual([])
        } else {
          expect(extraHeader.length).toBeLessThanOrEqual(1)
          for (const i of extraHeader) {
            expect(newHeader[i]).toBe('Job ID')
            expect(i).toBeGreaterThanOrEqual(oldHeader.length)
          }
        }
      }),
      { numRuns: 150 },
    )
  })
})
