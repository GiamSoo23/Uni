import type { Sponsorship } from '@uni/core'

const DAY_MS = 24 * 60 * 60 * 1000
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

/** "today", "yesterday", "5 days ago". */
export function daysAgo(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - date.getTime()) / DAY_MS)
  return relative.format(-Math.max(days, 0), 'day')
}

export function formatDateTime(date: Date): string {
  return dateTime.format(date)
}

export const SPONSORSHIP_LABELS: Record<
  Sponsorship,
  { text: string; tone: 'ok' | 'bad' | 'neutral' }
> = {
  offers: { text: 'Offers sponsorship', tone: 'ok' },
  does_not_offer: { text: 'No sponsorship', tone: 'bad' },
  citizenship_required: { text: 'Citizenship required', tone: 'bad' },
  unknown: { text: 'Sponsorship not stated', tone: 'neutral' },
}
