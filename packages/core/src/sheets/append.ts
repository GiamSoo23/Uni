import { normalizeCompanyName } from '../companies/policy'
import type { Job } from '../jobs/job'
import { jobIdFor } from './matcher'
import { buildNotes } from './notes'
import type { ApplicationRow } from './types'

/** The Status of every row Uni appends (Requirement 8.5). */
export const APPLIED_STATUS = 'Submitted'

/**
 * The Industry of the highest-numbered row in `rows` whose company equals `company` after
 * `normalizeCompanyName` and whose Industry is non-empty after trimming, as written (8.7).
 * `''` when no row matches (8.8). The result does not depend on row order.
 */
export function copyIndustry(company: string, rows: readonly ApplicationRow[]): string {
  const key = normalizeCompanyName(company)
  let best: ApplicationRow | null = null
  for (const row of rows) {
    if (row.industry.trim() === '' || normalizeCompanyName(row.company) !== key) continue
    if (best === null || row.rowNumber > best.rowNumber) best = row
  }
  return best?.industry ?? ''
}

/**
 * The row Mark as applied appends for `job` in the owner's format (Requirement 8.5). `today` is
 * Date Applied already formatted by `formatDateApplied`, and `rows` are the existing
 * Application_Rows that Industry is copied from (8.7, 8.8). App. #, Response Date, Next Step and
 * Next Step Date stay empty (8.9). Only the Job fields are used, never browser input (8.4).
 *
 * `rowNumber` is 0 because the row has no position until the service inserts it.
 */
export function buildAppliedRow(input: {
  job: Job
  today: string
  resumeVersion: string
  rows: readonly ApplicationRow[]
}): ApplicationRow {
  const { job, today, resumeVersion, rows } = input
  return {
    rowNumber: 0,
    company: job.company,
    role: job.title,
    linkText: job.url,
    linkUrl: job.url,
    dateApplied: today,
    status: APPLIED_STATUS,
    appNumber: '',
    location: job.locations.join('; '),
    industry: copyIndustry(job.company, rows),
    resumeVersion,
    responseDate: '',
    nextStep: '',
    nextStepDate: '',
    notes: buildNotes(job.url),
    jobId: jobIdFor(job),
  }
}
