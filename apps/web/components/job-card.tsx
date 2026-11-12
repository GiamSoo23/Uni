import type { Job } from '@uni/core'
import { daysAgo, SPONSORSHIP_LABELS } from '@/lib/format'

const TONES = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  bad: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
} as const

const MAX_LOCATIONS = 3

export function JobCard({ job, now }: { job: Job; now: Date }) {
  const sponsorship = SPONSORSHIP_LABELS[job.sponsorship]
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
          <span className={`rounded px-1.5 py-0.5 ${TONES[sponsorship.tone]}`}>
            {sponsorship.text}
          </span>
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
          Publicada {daysAgo(job.postedAt, now)}
        </span>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          Aplicar ↗
        </a>
      </div>
    </li>
  )
}
