import { describe, expect, it } from 'vitest'
import { job } from '../test/fixtures'
import { buildApplicationIndex, jobIdFor, matchApplication } from './matcher'
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

const JOB = job({
  id: 'abc',
  company: 'Acme, Inc.',
  title: 'Software  Engineer Intern',
  url: 'https://www.jobs.example/acme/1?utm_source=x',
})

function match(...rows: ApplicationRow[]): number | null {
  return matchApplication(JOB, buildApplicationIndex(rows))?.rowNumber ?? null
}

describe('jobIdFor', () => {
  it('prefixes the job id with the source', () => {
    expect(jobIdFor(JOB)).toBe('simplify:abc')
  })
})

describe('matchApplication', () => {
  const byUrl = appRow({ rowNumber: 3, linkUrl: 'https://jobs.example/acme/1/' })
  const byName = appRow({ rowNumber: 4, company: 'acme inc', role: ' software engineer  INTERN ' })

  it('prefers the trimmed, case-sensitive Job ID over URL and name matches', () => {
    expect(match(byUrl, byName, appRow({ rowNumber: 2, jobId: '  simplify:abc ' }))).toBe(2)
    expect(match(byUrl, byName, appRow({ rowNumber: 2, jobId: 'SIMPLIFY:abc' }))).toBe(3)
  })

  it('prefers the normalized URL over company and role', () => {
    expect(match(byName, byUrl)).toBe(3)
  })

  it('falls back to normalized company and role', () => {
    expect(match(byName)).toBe(4)
  })

  it('keeps the highest row number for the same key, in any order', () => {
    const later = { ...byName, rowNumber: 9 }
    expect(match(byName, later)).toBe(9)
    expect(match(later, byName)).toBe(9)
  })

  it('excludes rows with an empty company or role from name matching', () => {
    const blankCompany = job({ company: '  ', title: 'Intern', url: 'https://x.example/1' })
    const index = buildApplicationIndex([appRow({ company: '', role: 'Intern' })])
    expect(matchApplication(blankCompany, index)).toBeNull()
  })

  it('skips unparseable URLs without throwing and returns null when nothing matches', () => {
    const badRow = appRow({ linkUrl: 'not a url' })
    expect(match(badRow)).toBeNull()
    const badJob = job({ url: 'mailto:x@example.com', company: 'Acme Inc', title: 'Intern' })
    const index = buildApplicationIndex([
      badRow,
      appRow({ rowNumber: 5, company: 'ACME inc.', role: 'intern' }),
    ])
    expect(matchApplication(badJob, index)?.rowNumber).toBe(5)
  })
})
