import { CATEGORIES, DEFAULT_FILTERS, type JobFilters } from '@uni/core'
import { z } from 'zod'

export const PAGE_SIZE = 50

export type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * Query params come from the browser: they're validated here, and any invalid
 * value falls back to its default instead of breaking the page.
 */
const searchParamsSchema = z.object({
  q: z.string().trim().max(100).catch(''),
  term: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .catch(DEFAULT_FILTERS.term ?? 'all'),
  category: z.enum([...CATEGORIES, 'all']).catch('Software'),
  region: z.enum(['us', 'any']).catch(DEFAULT_FILTERS.region),
  eligible: z.enum(['hide', 'show']).catch('hide'),
  days: z.enum(['all', '3', '7', '14', '30']).catch('all'),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})

export type ViewParams = z.infer<typeof searchParamsSchema>

export function parseSearchParams(raw: RawSearchParams): ViewParams {
  const firstValues = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  )
  return searchParamsSchema.parse(firstValues)
}

export function toJobFilters(params: ViewParams): JobFilters {
  return {
    term: params.term === 'all' ? null : params.term,
    categories: params.category === 'all' ? [] : [params.category],
    region: params.region,
    hideIneligible: params.eligible === 'hide',
    postedWithinDays: params.days === 'all' ? null : Number(params.days),
    query: params.q,
  }
}

/** URL of the same view with some params changed (for pagination). */
export function hrefWith(params: ViewParams, changes: Partial<ViewParams>): string {
  const next = { ...params, ...changes }
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(next)) query.set(key, String(value))
  return `/?${query.toString()}`
}
