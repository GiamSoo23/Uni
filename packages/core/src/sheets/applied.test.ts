import { describe, expect, it } from 'vitest'
import { job } from '../test/fixtures'
import { partitionApplied } from './applied'
import { buildApplicationIndex } from './matcher'
import type { ApplicationRow } from './types'

function appRow(rowNumber: number, jobId: string, status: string): ApplicationRow {
  return {
    rowNumber,
    company: '',
    role: '',
    linkText: '',
    linkUrl: null,
    dateApplied: '',
    status,
    appNumber: '',
    location: '',
    industry: '',
    resumeVersion: '',
    responseDate: '',
    nextStep: '',
    nextStepDate: '',
    notes: '',
    jobId,
  }
}

const APPLIED = job({ id: 'a', company: 'Alpha', title: 'Intern A', url: 'https://a.example/1' })
const OPEN = job({ id: 'b', company: 'Beta', title: 'Intern B', url: 'https://b.example/1' })
const NOT_STARTED = job({
  id: 'c',
  company: 'Gamma',
  title: 'Intern C',
  url: 'https://c.example/1',
})
const JOBS = [APPLIED, OPEN, NOT_STARTED]

const INDEX = buildApplicationIndex([
  appRow(2, 'simplify:a', '  Rejected '),
  appRow(3, 'simplify:c', ' not STARTED '),
])

describe('partitionApplied', () => {
  it('hides and counts applied jobs in hide mode, keeping order', () => {
    const result = partitionApplied(JOBS, INDEX, 'hide')
    expect(result.visible).toEqual([OPEN, NOT_STARTED])
    expect(result.hiddenCount).toBe(1)
    expect(result.badges.size).toBe(0)
  })

  it('badges applied jobs with the trimmed Status in show mode', () => {
    const result = partitionApplied(JOBS, INDEX, 'show')
    expect(result.visible).toEqual(JOBS)
    expect(result.hiddenCount).toBe(0)
    expect([...result.badges]).toEqual([['simplify:a', 'Rejected']])
  })

  it('treats empty and "NO ROLE" statuses as not applied', () => {
    const index = buildApplicationIndex([
      appRow(2, 'simplify:a', ''),
      appRow(3, 'simplify:b', 'NO ROLE'),
    ])
    for (const mode of ['hide', 'show'] as const) {
      const result = partitionApplied(JOBS, index, mode)
      expect(result.visible).toEqual(JOBS)
      expect(result.badges.size).toBe(0)
      expect(result.hiddenCount).toBe(0)
    }
  })

  it('shows every job with no badges and no count when the index is null', () => {
    for (const mode of ['hide', 'show'] as const) {
      const result = partitionApplied(JOBS, null, mode)
      expect(result.visible).toEqual(JOBS)
      expect(result.badges.size).toBe(0)
      expect(result.hiddenCount).toBe(0)
    }
  })
})
