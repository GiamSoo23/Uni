import { z } from 'zod'
import type { Category, Job, Sponsorship } from '../jobs/job'

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * A record from `.github/scripts/listings.json` in the Simplify repo.
 * Optional fields have defaults so older records still parse.
 */
export const simplifyListingSchema = z.object({
  id: z.string().min(1),
  company_name: z.string().min(1),
  title: z.string().min(1),
  url: z.string().refine(isHttpUrl, 'url must be http(s)'),
  locations: z.array(z.string()).default([]),
  terms: z.array(z.string()).default([]),
  category: z.string().default('Other'),
  sponsorship: z.string().default('Other'),
  degrees: z.array(z.string()).default([]),
  active: z.boolean(),
  is_visible: z.boolean().default(true),
  date_posted: z.number().int().nonnegative(),
  date_updated: z.number().int().nonnegative().optional(),
})

export type SimplifyListing = z.infer<typeof simplifyListingSchema>

export class SimplifyFormatError extends Error {
  override name = 'SimplifyFormatError'
}

const CATEGORY_ALIASES: Record<string, Category> = {
  software: 'Software',
  'software engineering': 'Software',
  'ai/ml/data': 'AI/ML/Data',
  'data science, ai & machine learning': 'AI/ML/Data',
  hardware: 'Hardware',
  'hardware engineering': 'Hardware',
  product: 'Product',
  'product management': 'Product',
  quant: 'Quant',
  'quantitative finance': 'Quant',
}

const SPONSORSHIP_VALUES: Record<string, Sponsorship> = {
  'offers sponsorship': 'offers',
  'does not offer sponsorship': 'does_not_offer',
  'u.s. citizenship is required': 'citizenship_required',
}

export function normalizeCategory(raw: string): Category {
  return CATEGORY_ALIASES[raw.trim().toLowerCase()] ?? 'Other'
}

export function normalizeSponsorship(raw: string): Sponsorship {
  return SPONSORSHIP_VALUES[raw.trim().toLowerCase()] ?? 'unknown'
}

export function toJob(listing: SimplifyListing): Job {
  return {
    id: listing.id,
    source: 'simplify',
    company: listing.company_name.trim(),
    title: listing.title.trim(),
    url: listing.url,
    locations: listing.locations,
    terms: listing.terms,
    category: normalizeCategory(listing.category),
    sponsorship: normalizeSponsorship(listing.sponsorship),
    degrees: listing.degrees,
    active: listing.active && listing.is_visible,
    postedAt: new Date(listing.date_posted * 1000),
    updatedAt: listing.date_updated === undefined ? null : new Date(listing.date_updated * 1000),
  }
}

export interface ParsedListings {
  jobs: Job[]
  /** Records dropped because they did not match the schema. */
  invalid: number
}

/**
 * Validates the whole JSON. An invalid record is dropped and counted, so one
 * bad record never breaks the sync.
 */
export function parseListings(raw: unknown): ParsedListings {
  if (!Array.isArray(raw)) {
    throw new SimplifyFormatError('listings.json must be an array')
  }
  const jobs: Job[] = []
  let invalid = 0
  for (const item of raw) {
    const result = simplifyListingSchema.safeParse(item)
    if (result.success) jobs.push(toJob(result.data))
    else invalid += 1
  }
  if (raw.length > 0 && jobs.length === 0) {
    throw new SimplifyFormatError('No record matches the schema. Did the format change?')
  }
  return { jobs, invalid }
}
