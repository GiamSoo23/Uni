import { availableTerms, filterJobs, type SyncResult } from '@uni/core'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { FilterForm } from '@/components/filter-form'
import { JobCard } from '@/components/job-card'
import { Logo } from '@/components/logo'
import { formatDateTime } from '@/lib/format'
import { getListings, syncIntervalHours } from '@/lib/jobs'
import {
  hrefWith,
  PAGE_SIZE,
  parseSearchParams,
  toJobFilters,
  type RawSearchParams,
} from '@/lib/search-params'
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

  const now = new Date()
  const filtered = filterJobs(listings.jobs, toJobFilters(params), now)
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

      <FilterForm params={params} terms={availableTerms(listings.jobs)} />

      {visible.length === 0 ? (
        <p className="py-12 text-center text-zinc-500">No roles match these filters.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((job) => (
            <JobCard key={job.id} job={job} now={now} />
          ))}
        </ul>
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
