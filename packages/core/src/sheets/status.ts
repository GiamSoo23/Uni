/** Status values that mean the owner has not applied, compared trimmed and lowercased. */
const NOT_APPLIED_STATUSES: ReadonlySet<string> = new Set(['', 'no role', 'not started'])

/**
 * True when an Applications_Tab Status means the owner applied: any value other than empty,
 * "No Role" or "Not Started", compared after trimming and ignoring case.
 */
export function isAppliedStatus(status: string): boolean {
  return !NOT_APPLIED_STATUSES.has(status.trim().toLowerCase())
}
