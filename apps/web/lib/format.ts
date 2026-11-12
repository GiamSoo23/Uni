import type { EligibilityReason } from '@uni/core'

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

export type Tone = 'ok' | 'bad' | 'neutral'

export const ELIGIBILITY_LABELS: Record<EligibilityReason, { text: string; tone: Tone }> = {
  offers_sponsorship: { text: 'Offers sponsorship', tone: 'ok' },
  accepts: { text: 'Accepts international students', tone: 'ok' },
  no_sponsorship: { text: 'No sponsorship', tone: 'bad' },
  us_person_required: { text: 'U.S. person required', tone: 'bad' },
  citizenship_required: { text: 'U.S. citizenship required', tone: 'bad' },
  clearance_required: { text: 'Security clearance required', tone: 'bad' },
  not_verified: { text: 'Eligibility not verified', tone: 'neutral' },
}
