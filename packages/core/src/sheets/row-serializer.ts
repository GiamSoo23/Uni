import {
  APPLICATION_COLUMNS,
  type ApplicationField,
  type HeaderMap,
  normalizeHeader,
} from './header'
import type { ApplicationRow, Result } from './types'

/** The longest value Uni writes to one cell, apostrophe included (Requirement 4.7). */
export const MAX_CELL_LENGTH = 50_000

const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', "'"])

/** Normalized header name -> Application_Row field. */
const FIELD_BY_HEADER: ReadonlyMap<string, ApplicationField> = new Map(
  APPLICATION_COLUMNS.map(([field, header]) => [normalizeHeader(header), field]),
)

/**
 * Prefixes one apostrophe when `value` starts with `=`, `+`, `-`, `@` or `'`, so the Sheet stores
 * it as text and displays it without the apostrophe (Requirement 4.3).
 */
export function escapeCell(value: string): string {
  return FORMULA_PREFIXES.has(value.charAt(0)) ? `'${value}` : value
}

/**
 * The cell values of `row` in Header_Map order, one per `map.headers` position (Requirement 4.1).
 * Empty headers, headers that match no field and non-leftmost duplicates get `''`. Link is the
 * link URL, or the link text when the URL is null (4.2, 4.6). Every value is escaped (4.3); when an
 * escaped value is longer than {@link MAX_CELL_LENGTH}, the result is an error naming the column
 * and no cells (4.7).
 */
export function serializeApplicationRow(
  row: ApplicationRow,
  map: HeaderMap,
): Result<string[], { column: string }> {
  const cells: string[] = []
  for (const [column, header] of map.headers.entries()) {
    const key = normalizeHeader(header)
    const field = map.index.get(key) === column ? FIELD_BY_HEADER.get(key) : undefined
    const value = field === undefined ? '' : escapeCell(fieldValue(row, field))
    if (value.length > MAX_CELL_LENGTH) return { ok: false, error: { column: header } }
    cells.push(value)
  }
  return { ok: true, value: cells }
}

function fieldValue(row: ApplicationRow, field: ApplicationField): string {
  if (field === 'link') return row.linkUrl ?? row.linkText
  if (field === 'jobId') return row.jobId ?? ''
  return row[field]
}
