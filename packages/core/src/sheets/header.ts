import type { ApplicationRow } from './types'

/** Application_Row fields that map to a column of the Applications_Tab. */
export type ApplicationField =
  Exclude<keyof ApplicationRow, 'rowNumber' | 'linkUrl' | 'linkText'> | 'link'

/** Every Applications_Tab column, as `[field, header name]`, in the Tracker's order plus Job ID. */
export const APPLICATION_COLUMNS = [
  ['company', 'Company'],
  ['role', 'Role'],
  ['link', 'Link'],
  ['dateApplied', 'Date Applied'],
  ['status', 'Status'],
  ['appNumber', 'App. #'],
  ['location', 'Location'],
  ['industry', 'Industry'],
  ['resumeVersion', 'Resume Version'],
  ['responseDate', 'Response Date'],
  ['nextStep', 'Next Step'],
  ['nextStepDate', 'Next Step Date'],
  ['notes', 'Notes'],
  ['jobId', 'Job ID'],
] as const satisfies readonly (readonly [ApplicationField, string])[]

/** Columns the Applications_Tab must have for a read to succeed (Requirement 3.3). */
export const REQUIRED_APPLICATION_HEADERS = [
  'Company',
  'Role',
  'Link',
  'Date Applied',
  'Status',
  'Notes',
] as const

export interface HeaderMap {
  /** normalized name (trim + lowercase) -> 0-based column index, leftmost wins */
  readonly index: ReadonlyMap<string, number>
  /** Header cells in order, trimmed, '' for empty ones; length = position of rightmost non-empty header + 1. */
  readonly headers: readonly string[]
}

/** The key a header name is matched by: trimmed and lowercased. */
export function normalizeHeader(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Builds the Header_Map of a header row (Requirements 3.2 and 11.1): names are trimmed and
 * compared case-insensitively, empty cells are ignored, and the leftmost duplicate wins.
 */
export function buildHeaderMap(headerRow: readonly string[]): HeaderMap {
  const index = new Map<string, number>()
  const trimmed = headerRow.map((name) => name.trim())
  let length = 0
  trimmed.forEach((name, column) => {
    if (name === '') return
    length = column + 1
    const key = name.toLowerCase()
    if (!index.has(key)) index.set(key, column)
  })
  return { index, headers: trimmed.slice(0, length) }
}

/** The names in `required` that `map` has no column for, in the order of `required` (Requirement 3.3). */
export function missingColumns(map: HeaderMap, required: readonly string[]): string[] {
  return required.filter((name) => !map.index.has(normalizeHeader(name)))
}
