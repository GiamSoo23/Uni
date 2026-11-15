import type { Grid, RawCell } from '../sheets/types'

/** The real Tracker header row (13 columns, checked on Nov 15, 2026). There is no Job ID column yet. */
export const TRACKER_HEADER = [
  'Company',
  'Role',
  'Link',
  'Date Applied',
  'Status',
  'App. #',
  'Location',
  'Industry',
  'Resume Version',
  'Response Date',
  'Next Step',
  'Next Step Date',
  'Notes',
] as const

/** A Raw_Cell with the given displayed text and, optionally, a hyperlink and text format run links. */
export function cell(text = '', overrides: Partial<Omit<RawCell, 'text'>> = {}): RawCell {
  return { text, hyperlink: null, runLinks: [], ...overrides }
}

/** A row of Raw_Cells. Strings become plain-text cells; RawCells are kept as given. */
export function row(...values: readonly (string | RawCell)[]): RawCell[] {
  return values.map((value) => (typeof value === 'string' ? cell(value) : value))
}

/**
 * A Grid whose first row is `header` (sheet row 1), followed by `rows` (sheet rows 2, 3, ...).
 * Rows may be ragged, as the API returns them.
 */
export function grid(
  header: readonly string[] = TRACKER_HEADER,
  ...rows: readonly (readonly (string | RawCell)[])[]
): Grid {
  return [row(...header), ...rows.map((values) => row(...values))]
}
