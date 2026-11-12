import { describe, expect, it } from 'vitest'
import { job } from '../test/fixtures'
import { availableTerms, DEFAULT_FILTERS, filterJobs, type JobFilters } from './filters'

const now = new Date('2026-11-11T12:00:00Z')
const ids = (filters: Partial<JobFilters>, jobs = sample) =>
  filterJobs(jobs, { ...DEFAULT_FILTERS, ...filters }, now).map((j) => j.id)

const sample = [
  job({ id: 'swe', postedAt: new Date('2026-11-10T00:00:00Z') }),
  job({ id: 'closed', active: false }),
  job({ id: 'other-term', terms: ['Fall 2026'] }),
  job({ id: 'hardware', category: 'Hardware' }),
  job({ id: 'canada', locations: ['Toronto, ON, Canada'] }),
  job({ id: 'mixed', locations: ['Toronto, ON, Canada', 'Austin, TX'] }),
  job({ id: 'no-sponsorship', sponsorship: 'does_not_offer' }),
  job({ id: 'citizenship', sponsorship: 'citizenship_required' }),
  job({ id: 'old', postedAt: new Date('2026-09-01T00:00:00Z') }),
]

describe('filterJobs', () => {
  it('the default filters keep only eligible US Software roles for Summer 2027', () => {
    expect(ids({})).toEqual(['swe', 'mixed', 'old'])
  })

  it('never shows inactive roles', () => {
    expect(ids({ term: null, categories: [], region: 'any', hideIneligible: false })).not.toContain(
      'closed',
    )
  })

  it('shows ineligible roles when that filter is off', () => {
    expect(ids({ hideIneligible: false })).toEqual(
      expect.arrayContaining(['no-sponsorship', 'citizenship']),
    )
  })

  it('includes other regions with region "any"', () => {
    expect(ids({ region: 'any' })).toContain('canada')
  })

  it('filters by posting date', () => {
    expect(ids({ postedWithinDays: 7 })).toEqual(['swe'])
  })

  it('searches company and title, ignoring case', () => {
    const jobs = [job({ id: 'a', company: 'NVIDIA' }), job({ id: 'b', title: 'Backend Intern' })]
    expect(ids({ query: 'nvidia' }, jobs)).toEqual(['a'])
    expect(ids({ query: '  BACKEND ' }, jobs)).toEqual(['b'])
  })

  it('sorts from newest to oldest', () => {
    const jobs = [
      job({ id: 'older', postedAt: new Date('2026-10-01T00:00:00Z') }),
      job({ id: 'newer', postedAt: new Date('2026-11-05T00:00:00Z') }),
    ]
    expect(ids({}, jobs)).toEqual(['newer', 'older'])
  })
})

describe('availableTerms', () => {
  it('counts only active roles, skips N/A and sorts by frequency', () => {
    const jobs = [
      job({ terms: ['Summer 2027'] }),
      job({ terms: ['Summer 2027', 'Fall 2027'] }),
      job({ terms: ['N/A'] }),
      job({ terms: ['Winter 2027'], active: false }),
    ]
    expect(availableTerms(jobs)).toEqual(['Summer 2027', 'Fall 2027'])
  })
})
