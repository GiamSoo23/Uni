import { normalizeCompanyName } from '../companies/policy'
import type { Job } from '../jobs/job'
import type { ApplicationRow } from './types'
import { normalizeUrl } from './url'

/** The Job_ID Uni writes to the Job ID column for `job`. */
export function jobIdFor(job: Job): string {
  return `simplify:${job.id}`
}

/** Application_Rows keyed three ways. Each key maps to the row with the highest row number. */
export interface ApplicationIndex {
  /** Trimmed Job ID, case-sensitive. */
  byJobId: ReadonlyMap<string, ApplicationRow>
  /** URL_Normalizer key of the link URL. */
  byUrl: ReadonlyMap<string, ApplicationRow>
  /** Normalized company and role, see `companyRoleKey`. */
  byCompanyRole: ReadonlyMap<string, ApplicationRow>
}

/**
 * Indexes `rows` for `matchApplication` in one pass. The result does not depend on row order,
 * because each map keeps the highest-numbered row per key. Rows with an empty company or role are
 * left out of `byCompanyRole`, and rows whose link URL is not http(s) are left out of `byUrl`.
 */
export function buildApplicationIndex(rows: readonly ApplicationRow[]): ApplicationIndex {
  const byJobId = new Map<string, ApplicationRow>()
  const byUrl = new Map<string, ApplicationRow>()
  const byCompanyRole = new Map<string, ApplicationRow>()
  for (const row of rows) {
    const jobId = row.jobId?.trim() ?? ''
    if (jobId !== '') keepHighest(byJobId, jobId, row)
    const url = row.linkUrl === null ? null : normalizeUrl(row.linkUrl)
    if (url !== null) keepHighest(byUrl, url, row)
    if (row.company.trim() !== '' && row.role.trim() !== '') {
      keepHighest(byCompanyRole, companyRoleKey(row.company, row.role), row)
    }
  }
  return { byJobId, byUrl, byCompanyRole }
}

/**
 * The Application_Row recorded for `job`: by Job ID, else by normalized URL, else by company and
 * role, else null. A Job URL that is not http(s) skips URL matching. It never throws.
 */
export function matchApplication(job: Job, index: ApplicationIndex): ApplicationRow | null {
  const byJobId = index.byJobId.get(jobIdFor(job))
  if (byJobId !== undefined) return byJobId
  const url = normalizeUrl(job.url)
  const byUrl = url === null ? undefined : index.byUrl.get(url)
  if (byUrl !== undefined) return byUrl
  return index.byCompanyRole.get(companyRoleKey(job.company, job.title)) ?? null
}

function keepHighest(map: Map<string, ApplicationRow>, key: string, row: ApplicationRow): void {
  const current = map.get(key)
  if (current === undefined || row.rowNumber > current.rowNumber) map.set(key, row)
}

/** `normalizeCompanyName(company)`, a NUL separator, and the role trimmed, collapsed and lowercased. */
function companyRoleKey(company: string, role: string): string {
  const collapsedRole = role.trim().replace(/\s+/g, ' ').toLowerCase()
  return `${normalizeCompanyName(company)}\u0000${collapsedRole}`
}
