import { describe, expect, it } from 'vitest'
import { job } from '../test/fixtures'
import { availableTerms, DEFAULT_FILTERS, filterJobs, type JobFilters } from './filters'

const now = new Date('2026-11-11T12:00:00Z')
const ids = (filters: Partial<JobFilters>, jobs = sample) =>
  filterJobs(jobs, { ...DEFAULT_FILTERS, ...filters }, now).map((j) => j.id)

const sample = [
  job({ id: 'swe', postedAt: new Date('2026-11-10T00:00:00Z') }),
  job({ id: 'cerrada', active: false }),
  job({ id: 'otra-temporada', terms: ['Fall 2026'] }),
  job({ id: 'hardware', category: 'Hardware' }),
  job({ id: 'canada', locations: ['Toronto, ON, Canada'] }),
  job({ id: 'mixta', locations: ['Toronto, ON, Canada', 'Austin, TX'] }),
  job({ id: 'sin-sponsor', sponsorship: 'does_not_offer' }),
  job({ id: 'ciudadania', sponsorship: 'citizenship_required' }),
  job({ id: 'vieja', postedAt: new Date('2026-09-01T00:00:00Z') }),
]

describe('filterJobs', () => {
  it('con los filtros por defecto deja solo SWE Summer 2027 en EE. UU. y elegibles', () => {
    expect(ids({})).toEqual(['swe', 'mixta', 'vieja'])
  })

  it('nunca muestra ofertas inactivas', () => {
    expect(ids({ term: null, categories: [], region: 'any', hideIneligible: false })).not.toContain(
      'cerrada',
    )
  })

  it('muestra ofertas no elegibles si se desactiva el filtro', () => {
    expect(ids({ hideIneligible: false })).toEqual(
      expect.arrayContaining(['sin-sponsor', 'ciudadania']),
    )
  })

  it('incluye otras regiones con region "any"', () => {
    expect(ids({ region: 'any' })).toContain('canada')
  })

  it('filtra por fecha de publicación', () => {
    expect(ids({ postedWithinDays: 7 })).toEqual(['swe'])
  })

  it('busca en empresa y título sin distinguir mayúsculas', () => {
    const jobs = [job({ id: 'a', company: 'NVIDIA' }), job({ id: 'b', title: 'Backend Intern' })]
    expect(ids({ query: 'nvidia' }, jobs)).toEqual(['a'])
    expect(ids({ query: '  BACKEND ' }, jobs)).toEqual(['b'])
  })

  it('ordena de la más reciente a la más antigua', () => {
    const jobs = [
      job({ id: 'antigua', postedAt: new Date('2026-10-01T00:00:00Z') }),
      job({ id: 'nueva', postedAt: new Date('2026-11-05T00:00:00Z') }),
    ]
    expect(ids({}, jobs)).toEqual(['nueva', 'antigua'])
  })
})

describe('availableTerms', () => {
  it('cuenta solo ofertas activas, omite N/A y ordena por frecuencia', () => {
    const jobs = [
      job({ terms: ['Summer 2027'] }),
      job({ terms: ['Summer 2027', 'Fall 2027'] }),
      job({ terms: ['N/A'] }),
      job({ terms: ['Winter 2027'], active: false }),
    ]
    expect(availableTerms(jobs)).toEqual(['Summer 2027', 'Fall 2027'])
  })
})
