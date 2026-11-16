import { describe, expect, it, vi } from 'vitest'
import { job } from '../test/fixtures'
import { type FakeSheetState, type FakeTab, InMemorySheetsGateway } from '../test/fake-gateway'
import { TRACKER_HEADER } from '../test/sheets-fixtures'
import { DEFAULT_RESUME_VERSION } from './config'
import { SIMPLIFY_NOTE } from './notes'
import { createSheetsService } from './service'

const TRACKER_ID = 7
const SUMMARY_ID = 9
const JOB = job()
const JOB_ID = 'simplify:job-1'
const NOW = new Date('2026-11-12T15:00:00Z')

/** A Tracker row from header -> value pairs; unnamed columns stay empty. */
function trackerRow(values: Partial<Record<string, string>>, header: readonly string[]): string[] {
  return header.map((name) => values[name] ?? '')
}

const EXISTING = trackerRow(
  { Company: 'ACME', Role: 'Data Intern', Status: 'Rejected', Industry: 'Software', Notes: 'x' },
  TRACKER_HEADER,
)
const SPILLOVER = trackerRow({ Notes: 'more notes' }, TRACKER_HEADER)

function sheet(tracker: Partial<FakeTab> = {}, extraTabs: FakeTab[] = []): FakeSheetState {
  return {
    tabs: [
      {
        sheetId: TRACKER_ID,
        title: 'Tracker',
        rowCount: 10,
        columnCount: TRACKER_HEADER.length,
        rows: [[...TRACKER_HEADER], EXISTING, SPILLOVER, []],
        ...tracker,
      },
      {
        sheetId: SUMMARY_ID,
        title: 'Summary',
        rowCount: 2,
        columnCount: 2,
        rows: [['Total', '1']],
      },
      ...extraTabs,
    ],
  }
}

function setup(state: FakeSheetState) {
  const gateway = new InMemorySheetsGateway(state)
  const onWrite = vi.fn()
  const service = createSheetsService({
    gateway,
    settings: {
      resumeVersion: DEFAULT_RESUME_VERSION,
      timeZone: 'America/New_York',
      applicationsTab: ' tracker ',
    },
    now: () => NOW,
    randomSheetId: () => SUMMARY_ID,
    onWrite,
  })
  return { gateway, onWrite, service }
}

function trackerOf(gateway: InMemorySheetsGateway): FakeTab {
  const tab = gateway.tab('Tracker')
  if (tab === undefined) throw new Error('Tracker is missing')
  return tab
}

const WITH_JOB_ID = [...TRACKER_HEADER, 'Job ID']

describe('markAsApplied', () => {
  it('runs setup and inserts the row below the last non-empty row in one write', async () => {
    const { gateway, onWrite, service } = setup(sheet())

    await expect(service.markAsApplied(JOB)).resolves.toEqual({ kind: 'success', jobId: JOB_ID })

    const tracker = trackerOf(gateway)
    expect(tracker.rows[0]).toEqual(WITH_JOB_ID)
    expect(tracker.columnCount).toBe(WITH_JOB_ID.length)
    expect(tracker.rows[1]).toEqual(EXISTING)
    expect(tracker.rows[2]).toEqual(SPILLOVER)
    expect(tracker.rows[3]).toEqual(
      trackerRow(
        {
          Company: 'Acme',
          Role: 'Software Engineer Intern',
          Link: 'https://jobs.lever.co/acme/1',
          'Date Applied': 'Nov 12, 2026',
          Status: 'Submitted',
          Location: 'Tampa, FL',
          Industry: 'Software',
          Notes: `Lever. ${SIMPLIFY_NOTE}`,
          'Job ID': JOB_ID,
        },
        WITH_JOB_ID,
      ),
    )
    expect(tracker.rowCount).toBe(11)

    const companies = gateway.tab('Companies')
    expect(companies?.rows).toEqual([
      ['Company', 'Policy', 'Scope', 'Note', 'Evidence URL', 'Checked'],
    ])
    expect(companies?.sheetId).not.toBe(SUMMARY_ID)
    expect(gateway.tab('Summary')?.rows).toEqual([['Total', '1']])

    expect(gateway.count('read')).toBe(2)
    expect(gateway.count('write')).toBe(1)
    expect(gateway.calls.flatMap((call) => call.tabs).sort()).toEqual([
      'Companies',
      'Tracker',
      'Tracker',
    ])
    expect(onWrite).toHaveBeenCalledOnce()
  })

  it('appends at the end when the last non-empty row fills the grid', async () => {
    const { gateway, service } = setup(
      sheet({ rowCount: 3, rows: [[...TRACKER_HEADER], EXISTING, SPILLOVER] }),
    )

    await expect(service.markAsApplied(JOB)).resolves.toMatchObject({ kind: 'success' })

    const tracker = trackerOf(gateway)
    expect(tracker.rowCount).toBe(4)
    expect(tracker.rows[3]?.at(-1)).toBe(JOB_ID)
    const insert = gateway.calls.at(-1)?.ops?.find((op) => op.type === 'insertRow')
    expect(insert).toMatchObject({ rowIndex: 3, appendAtEnd: true })
  })

  it('returns already_recorded with the Status of the highest matching row and writes nothing', async () => {
    const rows = [
      [...WITH_JOB_ID],
      trackerRow({ Company: 'Acme', Status: 'Submitted', 'Job ID': JOB_ID }, WITH_JOB_ID),
      trackerRow({ Company: 'Acme', Status: ' Interview ', 'Job ID': JOB_ID }, WITH_JOB_ID),
    ]
    const companies: FakeTab = {
      sheetId: 3,
      title: 'Companies',
      rowCount: 5,
      columnCount: 6,
      rows: [],
    }
    const { gateway, onWrite, service } = setup(
      sheet({ columnCount: WITH_JOB_ID.length, rows }, [companies]),
    )

    await expect(service.markAsApplied(JOB)).resolves.toEqual({
      kind: 'already_recorded',
      jobId: JOB_ID,
      status: 'Interview',
    })
    expect(gateway.count('read')).toBe(2)
    expect(gateway.count('write')).toBe(0)
    expect(onWrite).not.toHaveBeenCalled()
  })

  it('adds one row for concurrent presses of the same job', async () => {
    const { gateway, service } = setup(sheet())

    const results = await Promise.all([
      service.markAsApplied(JOB),
      service.markAsApplied(JOB),
      service.markAsApplied(JOB),
    ])

    expect(results.map((result) => result.kind)).toEqual([
      'success',
      'already_recorded',
      'already_recorded',
    ])
    expect(trackerOf(gateway).rows.filter((values) => values.at(-1) === JOB_ID)).toHaveLength(1)
    expect(gateway.count('write')).toBe(1)
  })
})

describe('undoMarkAsApplied', () => {
  it('deletes the row Mark as applied added, with one read and one write', async () => {
    const { gateway, onWrite, service } = setup(sheet())
    await service.markAsApplied(JOB)
    const afterMark = trackerOf(gateway)
    const reads = gateway.count('read')

    await expect(service.undoMarkAsApplied(JOB_ID)).resolves.toEqual({
      kind: 'success',
      jobId: JOB_ID,
    })

    const tracker = trackerOf(gateway)
    expect(tracker.rows).toEqual(afterMark.rows.filter((values) => values.at(-1) !== JOB_ID))
    expect(tracker.rowCount).toBe(afterMark.rowCount - 1)
    expect(gateway.count('read') - reads).toBe(1)
    expect(gateway.count('write')).toBe(2)
    expect(gateway.calls.at(-1)?.ops).toEqual([
      { type: 'deleteRow', sheetId: TRACKER_ID, rowIndex: 3 },
    ])
    expect(onWrite).toHaveBeenCalledTimes(2)
  })

  it.each([0, 2])('returns not_unique and writes nothing when %i rows match', async (found) => {
    const owned = trackerRow({ Company: 'Acme', 'Job ID': JOB_ID }, WITH_JOB_ID)
    const rows = [[...WITH_JOB_ID], ...Array.from({ length: found }, () => [...owned])]
    const { gateway, onWrite, service } = setup(sheet({ columnCount: WITH_JOB_ID.length, rows }))

    await expect(service.undoMarkAsApplied(JOB_ID)).resolves.toEqual({
      kind: 'not_unique',
      jobId: JOB_ID,
      found,
    })
    expect(gateway.count('read')).toBe(1)
    expect(gateway.count('write')).toBe(0)
    expect(onWrite).not.toHaveBeenCalled()
  })
})
