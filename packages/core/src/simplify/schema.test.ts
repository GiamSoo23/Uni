import { describe, expect, it } from 'vitest'
import { rawListing } from '../test/fixtures'
import {
  normalizeCategory,
  normalizeSponsorship,
  parseListings,
  SimplifyFormatError,
} from './schema'

describe('parseListings', () => {
  it('normaliza un registro real de Simplify', () => {
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

  it('marca como inactiva una oferta oculta', () => {
    const { jobs } = parseListings([rawListing({ is_visible: false })])
    expect(jobs[0]?.active).toBe(false)
  })

  it('aplica valores por defecto a campos opcionales ausentes', () => {
    const minimal = rawListing()
    delete minimal.degrees
    delete minimal.sponsorship
    delete minimal.is_visible
    delete minimal.date_updated
    const { jobs } = parseListings([minimal])
    expect(jobs[0]).toMatchObject({ degrees: [], sponsorship: 'unknown', active: true })
    expect(jobs[0]?.updatedAt).toBeNull()
  })

  it('descarta y cuenta registros inválidos sin fallar', () => {
    const { jobs, invalid } = parseListings([
      rawListing(),
      rawListing({ id: 'sin-url', url: undefined }),
      'basura',
    ])
    expect(jobs).toHaveLength(1)
    expect(invalid).toBe(2)
  })

  it('rechaza links que no son http(s)', () => {
    const { jobs, invalid } = parseListings([
      rawListing({ url: 'javascript:alert(1)' }),
      rawListing({ id: 'ok' }),
    ])
    expect(jobs.map((j) => j.id)).toEqual(['ok'])
    expect(invalid).toBe(1)
  })

  it('falla si el JSON no es un arreglo', () => {
    expect(() => parseListings({ listings: [] })).toThrow(SimplifyFormatError)
  })

  it('falla si ningún registro cumple el esquema', () => {
    expect(() => parseListings([{ foo: 1 }, { bar: 2 }])).toThrow(SimplifyFormatError)
  })

  it('acepta un arreglo vacío', () => {
    expect(parseListings([])).toEqual({ jobs: [], invalid: 0 })
  })
})

describe('normalizeCategory', () => {
  it.each([
    ['Software', 'Software'],
    ['Software Engineering', 'Software'],
    ['Data Science, AI & Machine Learning', 'AI/ML/Data'],
    ['Product Management', 'Product'],
    ['Algo nuevo', 'Other'],
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
