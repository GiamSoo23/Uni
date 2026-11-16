import type { Job } from '../jobs/job'
import { type ApplicationIndex, jobIdFor, matchApplication } from './matcher'
import { isAppliedStatus } from './status'

/** The inbox job list after hiding or badging applied jobs. */
export interface AppliedPartition {
  /** Jobs to render, in their original order. */
  visible: Job[]
  /** Status text (trimmed) for visible jobs that carry an applied badge, keyed by Job_ID (`jobIdFor`). */
  badges: ReadonlyMap<string, string>
  /** Jobs removed because they are applied. Always 0 in `show` mode. */
  hiddenCount: number
}

/**
 * Splits already-filtered `jobs` by whether the Applied_Matcher finds a row with an Applied_Status.
 * In `hide` mode applied jobs are removed and counted. In `show` mode they stay and get a badge with
 * the row's trimmed Status. Jobs matched to a non-applied status stay visible without a badge. A
 * null `index` (no usable snapshot) returns every job, with no badges and a count of 0.
 */
export function partitionApplied(
  jobs: readonly Job[],
  index: ApplicationIndex | null,
  mode: 'hide' | 'show',
): AppliedPartition {
  const visible: Job[] = []
  const badges = new Map<string, string>()
  let hiddenCount = 0
  for (const job of jobs) {
    const row = index === null ? null : matchApplication(job, index)
    if (row === null || !isAppliedStatus(row.status)) {
      visible.push(job)
    } else if (mode === 'hide') {
      hiddenCount += 1
    } else {
      visible.push(job)
      badges.set(jobIdFor(job), row.status.trim())
    }
  }
  return { visible, badges, hiddenCount }
}
