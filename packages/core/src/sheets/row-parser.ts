import {
  APPLICATION_COLUMNS,
  type HeaderMap,
  REQUIRED_APPLICATION_HEADERS,
  buildHeaderMap,
  missingColumns,
  normalizeHeader,
} from './header'
import type { ApplicationRow, Grid, RawCell, Result, SheetIssue, SheetsFailure } from './types'
import { isHttpUrl } from './url'

export interface ParsedApplications {
  rows: ApplicationRow[]
  issues: SheetIssue[]
}

/**
 * The link URL of a Link cell (Requirements 3.4 to 3.7). The candidate is the hyperlink, else the
 * run link with the lowest start index, else the trimmed displayed text. The result is that
 * candidate when it is an absolute http(s) URL and null otherwise; a rejected candidate does not
 * fall through to the next one.
 */
export function resolveLinkUrl(cell: RawCell | undefined): string | null {
  if (cell === undefined) return null
  const candidate = cell.hyperlink ?? firstRunLink(cell) ?? cell.text.trim()
  return isHttpUrl(candidate) ? candidate : null
}

function firstRunLink(cell: RawCell): string | null {
  let first: RawCell['runLinks'][number] | null = null
  for (const run of cell.runLinks) {
    if (first === null || run.startIndex < first.startIndex) first = run
  }
  return first?.uri ?? null
}

/**
 * Parses the Applications_Tab grid, whose row 0 is the header (Requirement 3). It fails with
 * `invalid_sheet` / `missing_columns`, naming the missing columns in `detail`, when a required
 * header is missing. Spillover_Rows and all-empty rows are skipped; the other rows keep their
 * 1-based sheet row numbers. Every Job ID shared by two or more rows gives one `duplicate_job_id`
 * issue.
 */
export function parseApplicationsTab(grid: Grid): Result<ParsedApplications, SheetsFailure> {
  const map = buildHeaderMap((grid[0] ?? []).map((cell) => cell.text))
  const missing = missingColumns(map, REQUIRED_APPLICATION_HEADERS)
  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        category: 'invalid_sheet',
        httpStatus: null,
        reason: 'missing_columns',
        detail: missing.join(', '),
      },
    }
  }

  const rows: ApplicationRow[] = []
  grid.forEach((cells, index) => {
    if (index === 0) return
    const parsed = parseApplicationRow(cells, map, index + 1)
    if (parsed !== null) rows.push(parsed)
  })
  return { ok: true, value: { rows, issues: duplicateJobIdIssues(rows) } }
}

/**
 * Parses one data row against `map`, or returns null when the row is a Spillover_Row (3.9) or has
 * no non-empty cell under a header (3.10). Missing cells read as empty (3.15), cells without a
 * header are ignored (3.16), every text is trimmed (3.8) and a blank Job ID becomes null (3.12).
 */
export function parseApplicationRow(
  cells: readonly RawCell[],
  map: HeaderMap,
  rowNumber: number,
): ApplicationRow | null {
  const cellFor = (header: string): RawCell | undefined => {
    const column = map.index.get(normalizeHeader(header))
    return column === undefined ? undefined : cells[column]
  }
  const textOf = (header: string): string => cellFor(header)?.text.trim() ?? ''

  const isEmpty = map.headers.every(
    (header, column) => header === '' || (cells[column]?.text.trim() ?? '') === '',
  )
  if (isEmpty) return null

  const fields = Object.fromEntries(
    APPLICATION_COLUMNS.map(([field, header]) => [field, textOf(header)]),
  ) as Record<(typeof APPLICATION_COLUMNS)[number][0], string>

  if (fields.company === '' && fields.role === '' && fields.notes !== '') return null

  return {
    rowNumber,
    company: fields.company,
    role: fields.role,
    linkText: fields.link,
    linkUrl: resolveLinkUrl(cellFor('Link')),
    dateApplied: fields.dateApplied,
    status: fields.status,
    appNumber: fields.appNumber,
    location: fields.location,
    industry: fields.industry,
    resumeVersion: fields.resumeVersion,
    responseDate: fields.responseDate,
    nextStep: fields.nextStep,
    nextStepDate: fields.nextStepDate,
    notes: fields.notes,
    jobId: fields.jobId === '' ? null : fields.jobId,
  }
}

/** One issue per Job ID shared by two or more rows, in order of first appearance (3.13). */
function duplicateJobIdIssues(rows: readonly ApplicationRow[]): SheetIssue[] {
  const rowsByJobId = new Map<string, number[]>()
  for (const { jobId, rowNumber } of rows) {
    if (jobId === null) continue
    const numbers = rowsByJobId.get(jobId)
    if (numbers === undefined) rowsByJobId.set(jobId, [rowNumber])
    else numbers.push(rowNumber)
  }
  const issues: SheetIssue[] = []
  for (const [jobId, numbers] of rowsByJobId) {
    if (numbers.length > 1) issues.push({ type: 'duplicate_job_id', jobId, rows: numbers })
  }
  return issues
}
