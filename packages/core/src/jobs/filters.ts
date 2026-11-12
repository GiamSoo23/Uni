import type { Category, Job } from './job'
import { isUSLocation } from './location'

export type Region = 'us' | 'any'

export interface JobFilters {
  /** Temporada exacta, por ejemplo "Summer 2027". null para todas. */
  term: string | null
  /** Categorías aceptadas. Vacío significa todas. */
  categories: readonly Category[]
  region: Region
  /** Oculta ofertas donde la fuente dice que no patrocinan o piden ciudadanía. */
  hideIneligible: boolean
  /** Solo ofertas publicadas en los últimos N días. null para cualquier fecha. */
  postedWithinDays: number | null
  /** Texto libre que se busca en empresa y título. */
  query: string
}

export const DEFAULT_FILTERS: JobFilters = {
  term: 'Summer 2027',
  categories: ['Software'],
  region: 'us',
  hideIneligible: true,
  postedWithinDays: null,
  query: '',
}

const DAY_MS = 24 * 60 * 60 * 1000

export function isIneligible(job: Job): boolean {
  return job.sponsorship === 'does_not_offer' || job.sponsorship === 'citizenship_required'
}

/** Aplica los filtros duros y ordena de la más reciente a la más antigua. */
export function filterJobs(jobs: readonly Job[], filters: JobFilters, now = new Date()): Job[] {
  const query = filters.query.trim().toLowerCase()
  const since =
    filters.postedWithinDays === null ? null : now.getTime() - filters.postedWithinDays * DAY_MS

  return jobs
    .filter((job) => {
      if (!job.active) return false
      if (filters.term !== null && !job.terms.includes(filters.term)) return false
      if (filters.categories.length > 0 && !filters.categories.includes(job.category)) return false
      if (filters.region === 'us' && !job.locations.some(isUSLocation)) return false
      if (filters.hideIneligible && isIneligible(job)) return false
      if (since !== null && job.postedAt.getTime() < since) return false
      if (query !== '') {
        const haystack = `${job.company} ${job.title}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
    .sort(
      (a, b) =>
        b.postedAt.getTime() - a.postedAt.getTime() || a.company.localeCompare(b.company, 'en'),
    )
}

/** Temporadas presentes en las ofertas activas, de la más común a la menos común. */
export function availableTerms(jobs: readonly Job[]): string[] {
  const counts = new Map<string, number>()
  for (const job of jobs) {
    if (!job.active) continue
    for (const term of job.terms) counts.set(term, (counts.get(term) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([term]) => term !== 'N/A')
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
}
