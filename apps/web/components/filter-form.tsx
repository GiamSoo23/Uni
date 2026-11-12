import { CATEGORIES } from '@uni/core'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ViewParams } from '@/lib/search-params'

const fieldClass =
  'rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
      {label}
      {children}
    </label>
  )
}

/** A GET form: the filters live in the URL and work without JavaScript. */
export function FilterForm({ params, terms }: { params: ViewParams; terms: string[] }) {
  const termOptions =
    terms.includes(params.term) || params.term === 'all' ? terms : [params.term, ...terms]

  return (
    <form method="get" action="/" className="flex flex-wrap items-end gap-3">
      <Field label="Search">
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Company or title"
          maxLength={100}
          className={`${fieldClass} w-56`}
        />
      </Field>
      <Field label="Term">
        <select name="term" defaultValue={params.term} className={fieldClass}>
          <option value="all">All</option>
          {termOptions.map((term) => (
            <option key={term} value={term}>
              {term}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Category">
        <select name="category" defaultValue={params.category} className={fieldClass}>
          <option value="all">All</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Region">
        <select name="region" defaultValue={params.region} className={fieldClass}>
          <option value="us">US and US remote</option>
          <option value="any">Anywhere</option>
        </select>
      </Field>
      <Field label="Eligibility">
        <select name="eligible" defaultValue={params.eligible} className={fieldClass}>
          <option value="hide">Hide no sponsorship or citizenship required</option>
          <option value="show">Show all</option>
        </select>
      </Field>
      <Field label="Posted">
        <select name="days" defaultValue={params.days} className={fieldClass}>
          <option value="all">Any time</option>
          <option value="3">Last 3 days</option>
          <option value="7">Last week</option>
          <option value="14">Last 2 weeks</option>
          <option value="30">Last month</option>
        </select>
      </Field>
      <button
        type="submit"
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Filter
      </button>
      <Link
        href="/"
        className="py-1.5 text-sm text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        Reset
      </Link>
    </form>
  )
}
