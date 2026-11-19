import type { Eligibility, Job } from '@uni/core'
import type { ReactNode } from 'react'
import { daysAgo, ELIGIBILITY_LABELS } from '@/lib/format'

const TONES = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  bad: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
} as const

const MAX_LOCATIONS = 3

const SOURCE_TEXT = {
  simplify: 'From Simplify, for this role.',
  description: 'From this posting’s description:',
  company: 'Company policy.',
  sheet: 'From the Companies tab of your Sheet.',
  none: 'Neither Simplify nor the company list says. Check the posting.',
} as const

const SOURCE_SUFFIX = {
  description: ' · posting',
  company: ' · company',
  sheet: ' · your Sheet',
} as const

/** Where the answer comes from. A Company_Override from the Sheet is told apart from the base list (11.13). */
function sourceOf(eligibility: Eligibility): keyof typeof SOURCE_TEXT {
  if (eligibility.source === 'company' && eligibility.policy?.source === 'sheet') return 'sheet'
  return eligibility.source
}

function EligibilityBadge({
  eligibility,
  postingUrl,
}: {
  eligibility: Eligibility
  postingUrl: string
}) {
  const label = ELIGIBILITY_LABELS[eligibility.reason]
  const evidence = eligibility.policy?.evidence[0]
  const source = sourceOf(eligibility)
  const title = [
    SOURCE_TEXT[source],
    eligibility.flag && `“${eligibility.flag.quote}”`,
    eligibility.policy?.note,
    evidence && `“${evidence.quote}” (checked ${evidence.checkedAt})`,
  ]
    .filter(Boolean)
    .join(' ')
  const className = `rounded px-1.5 py-0.5 ${TONES[label.tone]}`
  const text =
    source === 'description' || source === 'company' || source === 'sheet'
      ? `${label.text}${SOURCE_SUFFIX[source]}`
      : label.text
  // A flag from the description links to the posting it quotes.
  const href = source === 'description' ? postingUrl : evidence?.url

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        className={`${className} underline decoration-dotted underline-offset-2`}
      >
        {text}
      </a>
    )
  }
  return (
    <span title={title} className={className}>
      {text}
    </span>
  )
}

export function JobCard({
  job,
  eligibility,
  now,
  controls,
}: {
  job: Job
  eligibility: Eligibility
  now: Date
  /** Client controls for the Sheet: Mark as applied, Undo or the applied badge. */
  controls?: ReactNode
}) {
  const extraLocations = job.locations.length - MAX_LOCATIONS

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{job.company}</p>
        <h2 className="font-semibold">{job.title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {job.locations.slice(0, MAX_LOCATIONS).join(' · ')}
          {extraLocations > 0 && ` · +${extraLocations}`}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
          <EligibilityBadge eligibility={eligibility} postingUrl={job.url} />
          {job.terms.map((term) => (
            <span key={term} className={`rounded px-1.5 py-0.5 ${TONES.neutral}`}>
              {term}
            </span>
          ))}
          {job.degrees.length > 0 && (
            <span className={`rounded px-1.5 py-0.5 ${TONES.neutral}`}>
              {job.degrees.join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Posted {daysAgo(job.postedAt, now)}
        </span>
        {controls}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          Apply ↗
        </a>
      </div>
    </li>
  )
}
