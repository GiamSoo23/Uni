import { describe, expect, it } from 'vitest'
import { TRACKER_HEADER, cell, grid } from '../test/sheets-fixtures'
import { parseApplicationsTab, resolveLinkUrl } from './row-parser'

const HEADER_WITH_JOB_ID = [...TRACKER_HEADER, 'Job ID']

/** A Tracker row with Job ID: Company, Role, Link, Status, Notes and Job ID set, the rest empty. */
function trackerRow(
  company: string,
  role: string,
  options: { link?: string | ReturnType<typeof cell>; notes?: string; jobId?: string } = {},
): (string | ReturnType<typeof cell>)[] {
  const { link = '', notes = '', jobId = '' } = options
  return [company, role, link, '', 'Submitted', '', '', '', '', '', '', '', notes, jobId]
}

describe('resolveLinkUrl', () => {
  it('prefers the hyperlink over run links and text', () => {
    const linked = cell('https://text.example', {
      hyperlink: 'https://hyper.example/job',
      runLinks: [{ startIndex: 0, uri: 'https://run.example' }],
    })
    expect(resolveLinkUrl(linked)).toBe('https://hyper.example/job')
  })

  it('uses the run link with the lowest start index', () => {
    const rich = cell('Apply here', {
      runLinks: [
        { startIndex: 6, uri: 'https://second.example' },
        { startIndex: 0, uri: 'https://first.example' },
      ],
    })
    expect(resolveLinkUrl(rich)).toBe('https://first.example')
  })

  it('falls back to the trimmed text when it is an http(s) URL', () => {
    expect(resolveLinkUrl(cell('  https://jobs.example/1  '))).toBe('https://jobs.example/1')
    expect(resolveLinkUrl(cell('LinkedIn'))).toBeNull()
    expect(resolveLinkUrl(undefined)).toBeNull()
  })

  it('gives null for a non-http(s) candidate without falling through', () => {
    const mail = cell('https://jobs.example/1', { hyperlink: 'mailto:hr@example.com' })
    expect(resolveLinkUrl(mail)).toBeNull()
  })
})

describe('parseApplicationsTab', () => {
  it('fails with invalid_sheet and names the missing columns', () => {
    const result = parseApplicationsTab(grid(['Company', 'Link', 'Date Applied', 'Notes']))
    expect(result).toEqual({
      ok: false,
      error: {
        category: 'invalid_sheet',
        httpStatus: null,
        reason: 'missing_columns',
        detail: 'Role, Status',
      },
    })
  })

  it('trims text, keeps sheet row numbers and skips spillover and empty rows', () => {
    const result = parseApplicationsTab(
      grid(
        TRACKER_HEADER,
        [' Acme ', 'SWE Intern', 'https://acme.example/job', 'sept 7', ' Submitted '],
        ['', ' ', '', '', '', '', '', '', '', '', '', '', 'spilled note'],
        ['  ', '', ''],
        [
          'Globex',
          'Data Intern',
          'LinkedIn',
          'ago 17, 2026',
          'No Role',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          'n',
          'extra',
        ],
      ),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [first, second] = result.value.rows
    expect(result.value.rows).toHaveLength(2)
    expect(first).toMatchObject({
      rowNumber: 2,
      company: 'Acme',
      linkText: 'https://acme.example/job',
      linkUrl: 'https://acme.example/job',
      dateApplied: 'sept 7',
      status: 'Submitted',
      notes: '',
      jobId: null,
    })
    expect(second).toMatchObject({
      rowNumber: 5,
      linkText: 'LinkedIn',
      linkUrl: null,
      dateApplied: 'ago 17, 2026',
      notes: 'n',
      jobId: null,
    })
    expect(result.value.issues).toEqual([])
  })

  it('reads Job IDs and reports each shared Job ID once', () => {
    const result = parseApplicationsTab(
      grid(
        HEADER_WITH_JOB_ID,
        trackerRow('Acme', 'SWE', { jobId: 'simplify:1' }),
        trackerRow('Globex', 'PM', { jobId: '  ' }),
        trackerRow('Acme', 'SWE', { jobId: ' simplify:1 ' }),
        trackerRow('Initech', 'QA', { jobId: 'simplify:1' }),
        trackerRow('Hooli', 'ML', { jobId: 'simplify:2' }),
      ),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows.map((r) => r.jobId)).toEqual([
      'simplify:1',
      null,
      'simplify:1',
      'simplify:1',
      'simplify:2',
    ])
    expect(result.value.issues).toEqual([
      { type: 'duplicate_job_id', jobId: 'simplify:1', rows: [2, 4, 5] },
    ])
  })
})
