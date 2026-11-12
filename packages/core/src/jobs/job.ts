/** What the source says about visa sponsorship. */
export type Sponsorship = 'offers' | 'does_not_offer' | 'citizenship_required' | 'unknown'

/** Canonical categories. Simplify uses different names for the same category. */
export const CATEGORIES = [
  'Software',
  'AI/ML/Data',
  'Hardware',
  'Product',
  'Quant',
  'Other',
] as const
export type Category = (typeof CATEGORIES)[number]

/** A normalized job posting, independent of its source. */
export interface Job {
  /** Stable ID within the source. */
  id: string
  source: 'simplify'
  company: string
  title: string
  /** Direct link to apply. Always http(s). */
  url: string
  locations: string[]
  /** Terms, for example "Summer 2027". */
  terms: string[]
  category: Category
  sponsorship: Sponsorship
  degrees: string[]
  /** Active and visible in the source. */
  active: boolean
  postedAt: Date
  updatedAt: Date | null
}
