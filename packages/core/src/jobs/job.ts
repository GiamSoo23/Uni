/** Qué dice la fuente sobre el patrocinio de visa. */
export type Sponsorship = 'offers' | 'does_not_offer' | 'citizenship_required' | 'unknown'

/** Categorías canónicas. Simplify usa nombres distintos para la misma categoría. */
export const CATEGORIES = [
  'Software',
  'AI/ML/Data',
  'Hardware',
  'Product',
  'Quant',
  'Other',
] as const
export type Category = (typeof CATEGORIES)[number]

/** Oferta normalizada, independiente de la fuente. */
export interface Job {
  /** ID estable dentro de la fuente. */
  id: string
  source: 'simplify'
  company: string
  title: string
  /** Link directo para aplicar. Siempre http(s). */
  url: string
  locations: string[]
  /** Temporadas, por ejemplo "Summer 2027". */
  terms: string[]
  category: Category
  sponsorship: Sponsorship
  degrees: string[]
  /** Activa y visible en la fuente. */
  active: boolean
  postedAt: Date
  updatedAt: Date | null
}
