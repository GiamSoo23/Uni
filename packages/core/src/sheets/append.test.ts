import { describe, expect, it } from 'vitest'
import { job } from '../test/fixtures'
import { buildAppliedRow, copyIndustry } from './append'
import type { ApplicationRow } from './types'

function appRow(overrides: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    rowNumber: 2,
    company: '',
    role: '',
    linkText: '',
    linkUrl: null,
    dateApplied: '',
    status: 'Submitted',
    appNumber: '',
    location: '',
    industry: '',
    resumeVersion: '',
    responseDate: '',
    nextStep: '',
    nextStepDate: '',
    notes: '',
    jobId: null,
    ...overrides,
  }
}

describe('copyIndustry', () => {
  it('copies the Industry of the highest-numbered matching row with a non-empty Industry', () => {
    const rows = [
      appRow({ rowNumber: 9, company: 'ACME, Inc', industry: '   ' }),
      appRow({ rowNumber: 5, company: 'acme inc', industry: 'Fintech' }),
      appRow({ rowNumber: 3, company: 'Acme Inc.', industry: 'Retail' }),
      appRow({ rowNumber: 12, company: 'Other', industry: 'Health' }),
    ]
    expect(copyIndustry('Acme Inc', rows)).toBe('Fintech')
  })

  it('returns an empty string when no row matches', () => {
    expect(copyIndustry('Acme', [])).toBe('')
    expect(copyIndustry('Acme', [appRow({ company: 'Acme', industry: '' })])).toBe('')
    expect(copyIndustry('Acme', [appRow({ company: 'Acmes', industry: 'Retail' })])).toBe('')
  })
})

describe('buildAppliedRow', () => {
  it('fills the row in the owner format and leaves the other fields empty', () => {
    const j = job({
      id: 'abc',
      company: 'Acme',
      title: 'SWE Intern',
      url: 'https://boards.greenhouse.io/acme/jobs/1',
      locations: ['Tampa, FL', 'Remote in USA'],
    })
    const rows = [appRow({ rowNumber: 4, company: 'acme', industry: 'Fintech' })]
    expect(buildAppliedRow({ job: j, today: 'Nov 12, 2026', resumeVersion: 'v3', rows })).toEqual({
      rowNumber: 0,
      company: 'Acme',
      role: 'SWE Intern',
      linkText: 'https://boards.greenhouse.io/acme/jobs/1',
      linkUrl: 'https://boards.greenhouse.io/acme/jobs/1',
      dateApplied: 'Nov 12, 2026',
      status: 'Submitted',
      appNumber: '',
      location: 'Tampa, FL; Remote in USA',
      industry: 'Fintech',
      resumeVersion: 'v3',
      responseDate: '',
      nextStep: '',
      nextStepDate: '',
      notes: 'Greenhouse. Found on the Simplify Summer 2027 GitHub list.',
      jobId: 'simplify:abc',
    })
  })

  it('writes an empty Location when the job has no locations', () => {
    const row = buildAppliedRow({
      job: job({ locations: [] }),
      today: 'Sep 7, 2026',
      resumeVersion: '',
      rows: [],
    })
    expect(row.location).toBe('')
    expect(row.industry).toBe('')
    expect(row.resumeVersion).toBe('')
  })
})
