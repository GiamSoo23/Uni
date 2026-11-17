import type { SheetIssue, SheetSnapshot } from '@uni/core'
import { describe, expect, it } from 'vitest'
import { failureText, sheetMessages } from '@/lib/sheet-messages'
import type { SheetState } from '@/lib/sheets/snapshot-cache'

const EMAIL = 'uni@project.iam.gserviceaccount.com'
const SNAPSHOT: SheetSnapshot = { applications: [], overrides: [], issues: [] }

const enabled = (overrides: Partial<Extract<SheetState, { mode: 'enabled' }>>): SheetState => ({
  mode: 'enabled',
  snapshot: SNAPSHOT,
  readAt: new Date('2026-11-17T15:00:00Z'),
  failure: null,
  clientEmail: EMAIL,
  ...overrides,
})
const texts = (state: SheetState) => sheetMessages(state).map((message) => message.text)

describe('sheetMessages', () => {
  it('names the variables in disabled mode and none of their values', () => {
    const [text, ...rest] = texts({
      mode: 'disabled',
      problems: [
        { name: 'UNI_SHEET_ID', kind: 'missing' },
        { name: 'GOOGLE_PRIVATE_KEY', kind: 'invalid' },
      ],
    })
    expect(rest).toEqual([])
    expect(text).toContain('missing UNI_SHEET_ID; invalid GOOGLE_PRIVATE_KEY')
    expect(text).not.toContain('BEGIN PRIVATE KEY')
  })

  it('shows nothing for a fresh snapshot without issues', () => {
    expect(sheetMessages(enabled({}))).toEqual([])
  })

  it('shows the last read time when a failure is served from the cache', () => {
    const [text] = texts(
      enabled({
        failure: { category: 'rate_limited', httpStatus: 429, reason: 'RESOURCE_EXHAUSTED' },
      }),
    )
    expect(text).toContain('(rate_limited)')
    expect(text).toContain('Showing your Sheet as of')
    expect(text).toContain('2026')
  })

  it('says the list falls back when a failure has no cache', () => {
    const [text] = texts(
      enabled({
        snapshot: null,
        readAt: null,
        failure: { category: 'network', httpStatus: null, reason: 'timeout' },
      }),
    )
    expect(text).toContain('(network)')
    expect(text).toContain('Showing every role without your Sheet.')
  })

  it('shows the service account email only for permission_denied', () => {
    const denied = texts(
      enabled({
        failure: { category: 'permission_denied', httpStatus: 403, reason: 'PERMISSION_DENIED' },
      }),
    )
    expect(denied[0]).toContain(EMAIL)
    const missing = texts(
      enabled({ failure: { category: 'not_found', httpStatus: 404, reason: 'NOT_FOUND' } }),
    )
    expect(missing[0]).toContain('UNI_SHEET_ID')
    expect(missing[0]).not.toContain(EMAIL)
  })

  it('reports duplicate Job IDs and a Companies header problem', () => {
    const issues: SheetIssue[] = [
      { type: 'duplicate_job_id', jobId: 'simplify:abc', rows: [4, 9] },
      { type: 'companies_header', missing: ['Policy', 'Checked'] },
    ]
    const [duplicates, header] = texts(enabled({ snapshot: { ...SNAPSHOT, issues } }))
    expect(duplicates).toContain('simplify:abc')
    expect(duplicates).toContain('rows 4 and 9')
    expect(header).toContain('Policy, Checked')
  })

  it('lists the first 20 skipped Companies rows and counts the rest', () => {
    const issues: SheetIssue[] = Array.from({ length: 23 }, (_, i) => ({
      type: 'override_row' as const,
      row: 30 - i,
      reason: 'unknown_policy' as const,
    }))
    issues.push({ type: 'duplicate_company', company: 'Acme', keptRow: 40, skippedRows: [2] })
    const [summary] = texts(enabled({ snapshot: { ...SNAPSHOT, issues } }))
    expect(summary).toContain('Skipped 24 rows')
    expect(summary).toContain('2, 8, 9, 10')
    expect(summary).toContain('26 and 4 more')
  })
})

describe('failureText', () => {
  it('names the tab or the columns for invalid_sheet', () => {
    expect(
      failureText({
        category: 'invalid_sheet',
        httpStatus: null,
        reason: 'missing_tab',
        detail: 'Tracker',
      }),
    ).toContain('“Tracker”')
    expect(
      failureText({
        category: 'invalid_sheet',
        httpStatus: null,
        reason: 'missing_columns',
        detail: 'Status, Notes',
      }),
    ).toContain('Status, Notes')
  })
})
