import type { DescriptionFlag } from './detector'

/** The strongest flag of each posting that has one, keyed by `jobIdFor(job)`. */
export type DescriptionIndex = ReadonlyMap<string, DescriptionFlag>

export const EMPTY_DESCRIPTION_INDEX: DescriptionIndex = new Map()
