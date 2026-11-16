import { describe, expect, it } from 'vitest'
import { companyPolicySchema } from '../companies/policy'
import { grid } from '../test/sheets-fixtures'
import {
  COMPANIES_COLUMNS,
  parseCompaniesTab,
  parsePolicyValue,
  summarizeOverrideIssues,
} from './overrides'
import type { SheetIssue } from './types'

const NOTE = 'Posting says no visa sponsorship.'

describe('parsePolicyValue', () => {
  it('reads values trimmed, case-insensitive and with spaces as underscores', () => {
    expect(parsePolicyValue('  No Sponsorship ')).toBe('no_sponsorship')
    expect(parsePolicyValue('ACCEPTS')).toBe('accepts')
    expect(parsePolicyValue('us person required')).toBe('us_person_required')
  })

  it('rejects unknown values', () => {
    expect(parsePolicyValue('')).toBeNull()
    expect(parsePolicyValue('no-sponsorship')).toBeNull()
    expect(parsePolicyValue('maybe')).toBeNull()
  })
})

describe('parseCompaniesTab', () => {
  it('builds a sheet override with trimmed fields', () => {
    const { overrides, issues } = parseCompaniesTab(
      grid(COMPANIES_COLUMNS, [
        ' Acme ',
        'No Sponsorship',
        ' SWE only ',
        ` ${NOTE} `,
        ' https://acme.com/jobs ',
        '2026-11-12',
      ]),
    )
    expect(issues).toEqual([])
    expect(overrides).toEqual([
      {
        company: 'Acme',
        aliases: [],
        policy: 'no_sponsorship',
        scope: 'SWE only',
        source: 'sheet',
        evidence: [{ quote: NOTE, url: 'https://acme.com/jobs', checkedAt: '2026-11-12' }],
      },
    ])
    expect(companyPolicySchema.safeParse(overrides[0]).success).toBe(true)
  })

  it('omits empty Scope and Evidence URL', () => {
    const { overrides } = parseCompaniesTab(
      grid(['Company', 'Policy', 'Note', 'Checked'], ['Acme', 'accepts', NOTE, '2026-11-12']),
    )
    expect(overrides).toHaveLength(1)
    expect(overrides[0]).not.toHaveProperty('scope')
    expect(overrides[0]?.evidence[0]).not.toHaveProperty('url')
  })

  it('records the first failing rule and skips all-empty rows silently', () => {
    const { overrides, issues } = parseCompaniesTab(
      grid(
        COMPANIES_COLUMNS,
        ['', 'maybe', '', 'short', '', ''],
        ['Acme', 'maybe', '', 'short', '', ''],
        ['Acme', 'accepts', '', 'short', 'ftp://x', ''],
        ['Acme', 'accepts', '', NOTE, 'ftp://x', 'Nov 12, 2026'],
        ['Acme', 'accepts', '', NOTE, '', 'Nov 12, 2026'],
        ['  ', '', '', ' ', '', ''],
        ['Acme', 'accepts', '', 'x'.repeat(301), '', '2026-11-12'],
        ['Acme', 'accepts', '', NOTE, '', '2026-02-30'],
      ),
    )
    expect(overrides).toEqual([])
    expect(issues).toEqual([
      { type: 'override_row', row: 2, reason: 'empty_company' },
      { type: 'override_row', row: 3, reason: 'unknown_policy' },
      { type: 'override_row', row: 4, reason: 'note_length' },
      { type: 'override_row', row: 5, reason: 'evidence_url' },
      { type: 'override_row', row: 6, reason: 'checked_date' },
      { type: 'override_row', row: 8, reason: 'note_length' },
      { type: 'override_row', row: 9, reason: 'checked_date' },
    ])
  })

  it('keeps the highest row of a duplicate normalized company', () => {
    const { overrides, issues } = parseCompaniesTab(
      grid(
        COMPANIES_COLUMNS,
        ['Acme, Inc.', 'accepts', '', NOTE, '', '2026-11-10'],
        ['Other', 'accepts', '', NOTE, '', '2026-11-10'],
        ['ACME inc', 'no_sponsorship', '', NOTE, '', '2026-11-11'],
        ['acme inc', 'clearance required', '', NOTE, '', '2026-11-12'],
      ),
    )
    expect(overrides.map((policy) => [policy.company, policy.policy])).toEqual([
      ['Other', 'accepts'],
      ['acme inc', 'clearance_required'],
    ])
    expect(issues).toEqual([
      { type: 'duplicate_company', company: 'acme inc', keptRow: 5, skippedRows: [2, 4] },
    ])
  })
})

describe('summarizeOverrideIssues', () => {
  it('lists sorted unique rows, at most 20, and counts the rest', () => {
    const issues: SheetIssue[] = [
      { type: 'duplicate_job_id', jobId: 'x', rows: [100] },
      { type: 'duplicate_company', company: 'Acme', keptRow: 40, skippedRows: [30, 3] },
      ...Array.from({ length: 25 }, (_, i): SheetIssue => ({
        type: 'override_row',
        row: 30 - i,
        reason: 'schema',
      })),
    ]
    const summary = summarizeOverrideIssues(issues)
    // Rows 6..30 from override_row, plus 3 (30 is shared); row 100 is not an override issue.
    expect(summary.count).toBe(26)
    expect(summary.rows).toEqual([3, ...Array.from({ length: 19 }, (_, i) => i + 6)])
    expect(summary.remaining).toBe(6)
  })

  it('gives an empty summary without override issues', () => {
    expect(summarizeOverrideIssues([])).toEqual({ count: 0, rows: [], remaining: 0 })
  })
})
