import { describe, expect, it } from 'vitest'
import { rawListing } from '../test/fixtures'
import {
  normalizeCategory,
  normalizeSponsorship,
  parseListings,
  SimplifyFormatError,
} from './schema'

describe('parseListings', () => {
  it('normalizes a real Simplify record', () => {
    const { jobs, invalid } = parseListings([rawListing()])
    expect(invalid).toBe(0)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      id: 'abc-123',
      source: 'simplify',
      company: 'Salesforce',
      category: 'Software',
      sponsorship: 'unknown',
      active: true,
      locations: ['San Francisco, CA'],
    })
    expect(jobs[0]?.postedAt.toISOString()).toBe('2026-11-11T00:00:00.000Z')
  })

  it('marks a hidden role as inactive', () => {
    const { jobs } = parseListings([rawListing({ is_visible: false })])
    expect(jobs[0]?.active).toBe(false)
  })

  it('applies defaults to missing optional fields', () => {
    const minimal = rawListing()
    delete minimal.degrees
    delete minimal.sponsorship
    delete minimal.is_visible
    delete minimal.date_updated
    const { jobs } = parseListings([minimal])
    expect(jobs[0]).toMatchObject({ degrees: [], sponsorship: 'unknown', active: true })
    expect(jobs[0]?.updatedAt).toBeNull()
  })

  it('drops and counts invalid records without failing', () => {
    const { jobs, invalid } = parseListings([
      rawListing(),
      rawListing({ id: 'no-url', url: undefined }),
      'garbage',
    ])
    expect(jobs).toHaveLength(1)
    expect(invalid).toBe(2)
  })

  it('rejects links that are not http(s)', () => {
    const { jobs, invalid } = parseListings([
      rawListing({ url: 'javascript:alert(1)' }),
      rawListing({ id: 'ok' }),
    ])
    expect(jobs.map((j) => j.id)).toEqual(['ok'])
    expect(invalid).toBe(1)
  })

  it('fails when the JSON is not an array', () => {
    expect(() => parseListings({ listings: [] })).toThrow(SimplifyFormatError)
  })

  it('fails when no record matches the schema', () => {
    expect(() => parseListings([{ foo: 1 }, { bar: 2 }])).toThrow(SimplifyFormatError)
  })

  it('accepts an empty array', () => {
    expect(parseListings([])).toEqual({ jobs: [], invalid: 0 })
  })
})

describe('normalizeCategory', () => {
  it.each([
    ['Software', 'Software'],
    ['Software Engineering', 'Software'],
    ['Data Science, AI & Machine Learning', 'AI/ML/Data'],
    ['Product Management', 'Product'],
    ['Something new', 'Other'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeCategory(raw)).toBe(expected)
  })
})

describe('normalizeSponsorship', () => {
  it.each([
    ['Offers Sponsorship', 'offers'],
    ['Does Not Offer Sponsorship', 'does_not_offer'],
    ['U.S. Citizenship is Required', 'citizenship_required'],
    ['Other', 'unknown'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeSponsorship(raw)).toBe(expected)
  })
})
