import {
  availableTerms,
  BASE_POLICIES,
  BASE_POLICY_INDEX,
  buildApplicationIndex,
  createPolicyIndex,
  eligibilityFor,
  filterJobs,
  jobIdFor,
  partitionApplied,
  type SyncResult,
} from '@uni/core'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AppliedBadge } from '@/components/applied-badge'
import { FilterForm } from '@/components/filter-form'
import { JobCard } from '@/components/job-card'
import { AppliedGate, AppliedStateProvider } from '@/components/job-list'
import { Logo } from '@/components/logo'
import { MarkAppliedButton } from '@/components/mark-applied'
import { SheetStatus } from '@/components/sheet-status'
import { formatDateTime } from '@/lib/format'
import { getListings, syncIntervalHours } from '@/lib/jobs'
import {
  hrefWith,
  PAGE_SIZE,
  parseSearchParams,
  toJobFilters,
  type RawSearchParams,
  type ViewParams,
} from '@/lib/search-params'
import { getSheetState } from '@/lib/sheets'
import { SyncButton } from './sync-button'

export default async function Home({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = parseSearchParams(await searchParams)

  let listings: SyncResult
  try {
    listings = await getListings()
  } catch (error) {
    console.error('Could not load the listings', error)
    return (
      <Shell>
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          Couldn’t download the Simplify listings, and there’s no local copy. Check your connection
          and press “Sync now”.
        </div>
        <SyncButton />
      </Shell>
    )
  }

  // Failures come back as values, so a Sheets problem never reaches the error page (2.7).
  // Rendering only reads the Sheet; it never writes (5.5).
  const sheet = await getSheetState()
  const snapshot = sheet.mode === 'enabled' ? sheet.snapshot : null
  const now = new Date()
  // Overrides from the Companies tab beat the base list (11.9).
  const policies =
    snapshot === null ? BASE_POLICY_INDEX : createPolicyIndex(BASE_POLICIES, snapshot.overrides)
  const filters = toJobFilters(params)
  const matching = filterJobs(listings.jobs, filters, { now, policies })
  const applied = partitionApplied(
    matching,
    snapshot === null ? null : buildApplicationIndex(snapshot.applications),
    params.applied,
  )
  const filtered = applied.visible
  const hidden = filters.hideIneligible
    ? filterJobs(listings.jobs, { ...filters, hideIneligible: false }, { now, policies }).filter(
        (job) => eligibilityFor(job, policies).status === 'ineligible',
      )
    : []
  const hiddenByCompany = hidden.filter(
    (job) => eligibilityFor(job, policies).source === 'company',
  ).length
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(params.page, pageCount)
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeCount = listings.jobs.filter((job) => job.active).length

  return (
    <Shell>
      <section className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          <strong className="text-zinc-900 dark:text-zinc-100">{filtered.length}</strong> roles
          match these filters, out of {activeCount.toLocaleString('en')} active on Simplify. Last
          sync: {formatDateTime(listings.fetchedAt)}. Refreshes every {syncInterval()}.
          {hidden.length > 0 && ` ${hiddenSummary(hidden.length, hiddenByCompany)}`}
          {applied.hiddenCount > 0 && <> {appliedSummary(applied.hiddenCount, params)}</>}
        </p>
        <SyncButton />
      </section>

      {listings.status === 'stale' && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Couldn’t refresh from GitHub ({listings.error}). Showing the last saved copy.
        </p>
      )}
      {listings.invalid > 0 && (
        <p className="text-xs text-zinc-500">
          {listings.invalid} Simplify records didn’t match the schema and were skipped.
        </p>
      )}

      <SheetStatus state={sheet} />

      <FilterForm params={params} terms={availableTerms(listings.jobs)} />

      {visible.length === 0 ? (
        <p className="py-12 text-center text-zinc-500">No roles match these filters.</p>
      ) : (
        <AppliedStateProvider mode={params.applied}>
          <ul className="space-y-3">
            {visible.map((job) => {
              const jobId = jobIdFor(job)
              const status = applied.badges.get(jobId)
              // The button only when the Sheet is configured and the role isn't applied (8.1).
              const controls =
                status !== undefined ? (
                  <AppliedBadge status={status} />
                ) : sheet.mode === 'enabled' ? (
                  <MarkAppliedButton jobId={jobId} />
                ) : undefined
              return (
                <AppliedGate key={job.id} jobId={jobId} label={`${job.company} · ${job.title}`}>
                  <JobCard
                    job={job}
                    eligibility={eligibilityFor(job, policies)}
                    now={now}
                    controls={controls}
                  />
                </AppliedGate>
              )
            })}
          </ul>
        </AppliedStateProvider>
      )}

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-4 text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={hrefWith(params, { page: page - 1 })} className="underline">
              ← Previous
            </Link>
          ) : (
            <span className="text-zinc-400">← Previous</span>
          )}
          <span>
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={hrefWith(params, { page: page + 1 })} className="underline">
              Next →
            </Link>
          ) : (
            <span className="text-zinc-400">Next →</span>
          )}
        </nav>
      )}
    </Shell>
  )
}

function hiddenSummary(hidden: number, byCompany: number): string {
  const roles = hidden === 1 ? 'role' : 'roles'
  const detail = byCompany > 0 ? ` (${byCompany} by company policy)` : ''
  return `${hidden} ${roles} hidden because they don’t accept international students${detail}.`
}

function appliedSummary(count: number, params: ViewParams): ReactNode {
  const roles = count === 1 ? 'role' : 'roles'
  return (
    <>
      {count} {roles} hidden because they’re already in your Sheet (
      <Link href={hrefWith(params, { applied: 'show', page: 1 })} className="underline">
        show them
      </Link>
      ).
    </>
  )
}

function syncInterval(): string {
  if (syncIntervalHours % 24 !== 0) return `${syncIntervalHours} h`
  const days = syncIntervalHours / 24
  return days === 1 ? 'day' : `${days} days`
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Logo className="h-8 w-8 dark:brightness-150" />
          Uni
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Open internships, filtered by eligibility, with a direct link to apply.
        </p>
      </header>
      {children}
      <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        Data from{' '}
        <a
          href="https://github.com/SimplifyJobs/Summer2027-Internships"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          SimplifyJobs/Summer2027-Internships
        </a>
        , maintained by Simplify and Pitt CSC.
      </footer>
    </main>
  )
}
